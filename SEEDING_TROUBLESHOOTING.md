# Seeding Database - Troubleshooting Guide

## Problem: Insufficient Permission Error

The error `auth/insufficient-permission` occurs because your Firebase service account doesn't have the necessary IAM roles to create users in Firebase Authentication.

## Important Note: Schemas & Repositories

**Good news**: Your schemas and repositories are already set up! The codebase includes:
- ✅ All TypeScript types in `src/types/`
- ✅ All repositories in `src/repositories/`
- ✅ All schemas in `src/schemas/`

The issue is **purely about Firebase permissions**, not missing code.

## Solution Options

### Option 1: Grant Proper IAM Roles to Service Account (Recommended)

Your Firebase service account needs the **Firebase Admin** role to create users.

#### Steps:

1. **Go to Google Cloud Console IAM**:
   - Visit: https://console.cloud.google.com/iam-admin/iam?project=gurukul-ai-bdf19
   - Or: Firebase Console → Project Settings → Service Accounts → Manage Service Account Permissions

2. **Find Your Service Account**:
   - Look for the service account email from your `.env` file (`FIREBASE_CLIENT_EMAIL`)
   - It should look like: `firebase-adminsdk-xxxxx@gurukul-ai-bdf19.iam.gserviceaccount.com`

3. **Grant Required Roles**:
   Click "Edit" on the service account and add these roles:
   - **Firebase Admin SDK Administrator Service Agent** (or `roles/firebase.admin`)
   - **Service Account User** (or `roles/iam.serviceAccountUser`)

   **Minimum required role**: `Firebase Admin SDK Administrator Service Agent`

4. **Wait a few minutes** for permissions to propagate

5. **Try seeding again**:
   ```bash
   npm run seed:prod
   ```

#### Alternative: Using Firebase Console

1. Go to: https://console.firebase.google.com/project/gurukul-ai-bdf19/settings/serviceaccounts/adminsdk
2. Click "Manage Service Account Permissions"
3. Add the `Firebase Admin SDK Administrator Service Agent` role

### Option 2: Use Firebase Emulators (For Development)

If you're just developing/testing, use the emulators instead:

1. **Start Firebase Emulators**:
   ```bash
   npm run test:emulators
   ```
   This starts Auth and Firestore emulators on ports 9099 and 8080.

2. **In a new terminal, run the seed script**:
   ```bash
   npm run seed
   ```
   (Note: This uses the regular `seed` command, not `seed:prod`)

3. **The emulators will automatically use the seed data**

### Option 3: Create Users Manually in Firebase Console

If you can't modify IAM roles, you can create users manually:

1. **Go to Firebase Console → Authentication**:
   - https://console.firebase.google.com/project/gurukul-ai-bdf19/authentication/users

2. **Add users manually** with the emails from the seed script:
   - `platform.admin@gurucool.dev` (or your production admin email)
   - Set passwords
   - Verify emails

3. **Set Custom Claims** (for each user):
   - You'll need to use a script or Firebase Admin SDK to set custom claims
   - Claims needed: `role`, `schoolId`, `status`

4. **Then seed only Firestore data** (modify seed script to skip user creation)

### Option 4: Modify Seed Script to Skip Auth (Advanced)

If you can't get permissions, you can modify the seed script to:
- Only create Firestore documents
- Skip Firebase Auth user creation
- Assume users are created manually

**Warning**: This requires code changes and may break the seed script's logic.

## Verifying Your Service Account

### Check Current Permissions

1. **Get your service account email from `.env`**:
   ```bash
   grep FIREBASE_CLIENT_EMAIL .env
   ```

2. **Check IAM roles in Google Cloud Console**:
   - https://console.cloud.google.com/iam-admin/iam?project=gurukul-ai-bdf19
   - Find your service account email
   - Check the "Roles" column

### Verify Service Account Key

Make sure your `.env` has the correct credentials:

```env
FIREBASE_PROJECT_ID=gurukul-ai-bdf19
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gurukul-ai-bdf19.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important**: The `FIREBASE_PRIVATE_KEY` must:
- Be wrapped in quotes
- Have `\n` characters (not actual newlines)
- Include the full key with BEGIN/END markers

## What the Seed Script Does

The seed script (`scripts/seed.ts`) performs these operations:

1. **Creates Firebase Auth Users** (`auth.createUser()`)
   - Requires: `Firebase Admin SDK Administrator Service Agent` role

2. **Sets Custom Claims** (`auth.setCustomUserClaims()`)
   - Requires: Same role as above
   - Sets: `role`, `schoolId`, `status`

3. **Creates Firestore Documents** (`db.collection().set()`)
   - Requires: Firestore write permissions (usually already granted)

4. **Creates Schools, Credentials, Notifications**
   - All Firestore operations

## Recommended Approach

**For Production/Real Data**:
- Use **Option 1** (grant IAM roles)
- This is the proper way to set up service accounts

**For Development/Testing**:
- Use **Option 2** (Firebase Emulators)
- Faster, safer, doesn't affect production

## Testing After Fix

Once permissions are fixed, test with:

```bash
# Test with production
npm run seed:prod

# Or test with emulators
npm run test:emulators  # In one terminal
npm run seed            # In another terminal
```

## Common Issues

### Issue: "Service account not found"
- **Solution**: Verify `FIREBASE_CLIENT_EMAIL` matches the service account in Firebase Console

### Issue: "Invalid private key"
- **Solution**: Check that `FIREBASE_PRIVATE_KEY` has `\n` characters, not actual newlines
- The key should be in quotes: `FIREBASE_PRIVATE_KEY="-----BEGIN...\n...\n-----END..."`

### Issue: "Project ID mismatch"
- **Solution**: Verify `FIREBASE_PROJECT_ID=gurukul-ai-bdf19` in your `.env`

### Issue: "Still getting permission errors after granting roles"
- **Solution**: Wait 2-5 minutes for IAM changes to propagate, then try again

## Next Steps After Successful Seeding

Once seeding works:

1. **Verify users in Firebase Console**:
   - https://console.firebase.google.com/project/gurukul-ai-bdf19/authentication/users

2. **Verify Firestore data**:
   - https://console.firebase.google.com/project/gurukul-ai-bdf19/firestore/data

3. **Test login with seeded users**:
   - Use the emails and passwords from the seed script
   - Default password: `Password123!` (or `SEED_USER_PASSWORD` from `.env`)

4. **Seed additional data** (if needed):
   ```bash
   # Competency questions
   ts-node --project tsconfig.scripts.json scripts/seedCompetencyQuestions.ts
   
   # PD modules
   ts-node --project tsconfig.scripts.json scripts/seed-pd-modules.ts
   ```

## Summary

- ✅ **Schemas and repositories are already set up** - no need to create them
- ❌ **The issue is Firebase IAM permissions** - service account needs `Firebase Admin SDK Administrator Service Agent` role
- 🔧 **Fix**: Grant the role in Google Cloud Console IAM
- 🧪 **Alternative**: Use Firebase Emulators for development

