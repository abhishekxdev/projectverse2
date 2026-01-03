# 🎯 Complete Testing Solution for Competency Assessment & PD Modules

## Executive Summary

You now have **5 different ways** to test competency assessments and PD modules with video/audio uploads, **without using Postman**:

1. **Automated TypeScript Scripts** ⭐ Recommended
2. **Quick EC2 Health Check Script**
3. **cURL Scripts**
4. **Jest Integration Tests**
5. **HTTP Client Files** (VS Code)

---

## 🚀 Quick Start (30 seconds)

### Test Your EC2 Deployment

```bash
# 1. Quick health check
./scripts/test-ec2.sh

# 2. Full test with video upload
pnpm create:test-media
BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api pnpm test:competency-flow
```

---

## 📁 What Was Created

### Test Scripts
```
scripts/
├── test-competency-flow.ts      # Complete competency test (TypeScript)
├── test-pd-flow.ts               # Complete PD module test (TypeScript)
├── test-ec2.sh                   # Quick EC2 health check (Bash)
├── test-competency-curl.sh       # cURL-based testing (Bash)
└── create-test-media.sh          # Generate sample video/audio files
```

### Documentation
```
docs/
├── TESTING_GUIDE.md              # Complete testing guide
└── EC2_TESTING.md                # EC2-specific testing guide
```

### Configuration
```
.env.test.example                 # Test environment template
test-data/                        # Sample media files directory
```

---

## 🎬 Video/Audio Upload Handling

### The Challenge
Competency assessments include video/audio questions that need file uploads to S3.

### The Solution: Presigned URLs (2-Step Process)

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Request Presigned URL from Your API            │
│ POST /api/upload/presigned-url                         │
│ → Returns S3 upload URL + metadata                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Upload File Directly to S3                     │
│ PUT <presigned-url>                                     │
│ → File stored in S3 bucket                             │
└─────────────────────────────────────────────────────────┘
```

### File Limits
- **Video**: 100MB (MP4, WebM, QuickTime)
- **Audio**: 50MB (MP3, WAV, WebM, M4A)

---

## 📋 Available Commands

### Setup
```bash
pnpm install                      # Install dependencies
pnpm create:test-media            # Create sample video/audio files
```

### Testing
```bash
# Local testing
pnpm test:competency-flow         # Test competency assessment
pnpm test:pd-flow                 # Test PD modules

# EC2 testing
./scripts/test-ec2.sh             # Quick health check
BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api \
  pnpm test:competency-flow       # Full EC2 test

# With custom credentials
pnpm test:competency-flow -- --email=your@email.com --password=pass123
```

### Jest Tests
```bash
pnpm test                         # All tests
pnpm test:unit                    # Unit tests only
pnpm test:e2e                     # Integration tests only
```

---

## 🎯 Testing Strategy by Use Case

### For Daily Development
```bash
pnpm test:unit                    # Fast feedback
```

### For Feature Testing
```bash
pnpm test:competency-flow         # Complete flow
```

### For EC2 Deployment Validation
```bash
./scripts/test-ec2.sh             # Quick check
BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api \
  pnpm test:competency-flow       # Full validation
```

### For CI/CD Pipeline
```bash
pnpm test                         # All automated tests
```

### For Manual Debugging
```bash
./scripts/test-competency-curl.sh # Step-by-step cURL
```

---

## 🔧 Configuration Options

### Method 1: Environment Variables
```bash
export BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api
export TEST_EMAIL=teacher@test.com
export TEST_PASSWORD=password123

pnpm test:competency-flow
```

### Method 2: .env.test File
```bash
# Create .env.test
cp .env.test.example .env.test

# Edit values
vim .env.test

# Run tests (automatically loads .env.test)
pnpm test:competency-flow
```

### Method 3: Command Line Arguments
```bash
pnpm test:competency-flow -- --email=teacher@test.com --password=pass123
```

---

## 📊 What Each Script Tests

### `test-competency-flow.ts` (Automated TypeScript)
✅ Authentication  
✅ Fetch questions  
✅ Start attempt  
✅ **Upload video (S3 presigned URL)**  
✅ **Upload audio (S3 presigned URL)**  
✅ Save progress  
✅ Submit assessment  
✅ Trigger evaluation  
✅ Get results  
✅ List attempts  

### `test-pd-flow.ts` (Automated TypeScript)
✅ Authentication  
✅ List modules  
✅ Get module details  
✅ Get questions  
✅ Start attempt  
✅ **Upload video responses**  
✅ Save responses  
✅ Submit attempt  
✅ Get results  

### `test-ec2.sh` (Quick Bash)
✅ Health check  
✅ Authentication  
✅ API access  
✅ S3 configuration  

---

## 🎥 Complete Video Upload Example

```typescript
// 1. Authenticate
const auth = await axios.post(`${BASE_URL}/auth/login`, {
  email: 'teacher@test.com',
  password: 'password123'
});
const token = auth.data.data.idToken;

// 2. Start attempt
const attempt = await axios.post(
  `${BASE_URL}/competency/attempts`, {},
  { headers: { Authorization: `Bearer ${token}` }}
);
const attemptId = attempt.data.data.attemptId;

// 3. Request presigned URL
const presigned = await axios.post(
  `${BASE_URL}/upload/presigned-url`,
  {
    fileType: 'assessment-video',
    fileName: 'response.mp4',
    contentType: 'video/mp4',
    metadata: { attemptId, questionId: 'q1' }
  },
  { headers: { Authorization: `Bearer ${token}` }}
);

// 4. Upload to S3
const videoBuffer = fs.readFileSync('video.mp4');
await axios.put(presigned.data.data.uploadUrl, videoBuffer, {
  headers: { 'Content-Type': 'video/mp4' }
});

// 5. Submit assessment (video URL stored in metadata)
await axios.post(
  `${BASE_URL}/competency/submit`,
  { attemptId, answers: [...] },
  { headers: { Authorization: `Bearer ${token}` }}
);
```

---

## 🐛 Troubleshooting

### Issue: "No test files found"
**Solution:**
```bash
pnpm create:test-media
```

### Issue: "S3 not configured"
**Check EC2 server has:**
- AWS IAM role attached (recommended for EC2)
- OR AWS credentials in `.env`:
  ```env
  AWS_REGION=eu-north-1
  AWS_S3_BUCKET_NAME=your-bucket
  AWS_ACCESS_KEY_ID=xxx
  AWS_SECRET_ACCESS_KEY=xxx
  ```

### Issue: "Authentication failed"
**Solution:**
```bash
# Create test user on EC2
ssh ec2-user@ec2-13-62-52-105.eu-north-1.compute.amazonaws.com
cd /path/to/app
pnpm seed  # Creates test users
```

### Issue: "File too large"
**Solution:**
- Use presigned URL method (not multipart)
- Compress video: `ffmpeg -i input.mp4 -vcodec h264 -acodec aac output.mp4`
- Keep videos under 100MB, audio under 50MB

---

## 📈 Performance Testing

Test with multiple concurrent users:

```bash
# 10 concurrent tests
for i in {1..10}; do
  BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api \
    pnpm test:competency-flow &
done
wait
```

---

## ✅ Testing Checklist

Before deployment:
- [ ] Health check passes (`./scripts/test-ec2.sh`)
- [ ] Authentication works
- [ ] Can fetch questions
- [ ] Can upload video to S3
- [ ] Can upload audio to S3
- [ ] Can submit assessment
- [ ] Can retrieve results
- [ ] All Jest tests pass (`pnpm test`)

---

## 🎓 Next Steps

1. **Run Quick Test:**
   ```bash
   ./scripts/test-ec2.sh
   ```

2. **Create Test Media:**
   ```bash
   pnpm create:test-media
   ```

3. **Run Full Test:**
   ```bash
   BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api \
     pnpm test:competency-flow
   ```

4. **Review Results:** Check console output for detailed step-by-step results

5. **Test PD Modules:**
   ```bash
   BASE_URL=http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api \
     pnpm test:pd-flow
   ```

---

## 📚 Documentation

- **Complete Guide:** [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **EC2 Testing:** [docs/EC2_TESTING.md](docs/EC2_TESTING.md)
- **API Contract:** [docs/API-contract.md](docs/API-contract.md)

---

**You're all set!** 🎉

Run `./scripts/test-ec2.sh` to verify your EC2 deployment is working.
