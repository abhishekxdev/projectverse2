# Gurucool AI Backend

A comprehensive backend system for teacher assessment, personalized learning, and credential management powered by AI.

## Features

- **Assessment System**: AI-powered evaluation of teacher competencies
- **Personalized Learning**: Adaptive learning modules based on assessment results
- **AI Tutor**: Interactive chat-based tutoring with usage limits
- **Credential Management**: Badges and certificates for achievements
- **School Management**: Admin tools for teacher invitations and progress tracking

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Framework**: Express.js 4.x
- **Database**: Firestore (Firebase)
- **Authentication**: Firebase Auth
- **AI Integration**: OpenAI API (GPT-4)
- **File Storage**: Firebase Cloud Storage
- **Validation**: Zod
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js 20+ installed
- Firebase project with Firestore, Auth, and Storage enabled
- OpenAI API key
- **ffmpeg** installed (required for video transcription)
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Installation and Quick Start

1. Clone the repository

```bash
git clone <repository-url>
cd gurucool-ai-backend
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
```

4. Configure your environment variables (see Environment Variables section below)

5. Start development server

```bash
npm run dev
```

## Running Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project
- `npm start` - Start production server
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode

## Environment Variables

Create a `.env` file based on `.env.example` with the following variables:

### Required Variables

| Variable                | Description                                                 | Example                                              |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | Your Firebase project ID                                    | `my-project-123`                                     |
| `FIREBASE_CLIENT_EMAIL` | Service account email for Firebase                          | `service-account@my-project.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY`  | Private key for Firebase service account (include newlines) | `"-----BEGIN PRIVATE KEY-----\n..."`                 |
| `OPENAI_API_KEY`        | Your OpenAI API key for AI features                         | `sk-...`                                             |
| `AUTH_JWT_SECRET`       | Secret used to sign backend-issued JWT tokens               | `super-secret-string`                                |

### Optional Variables

| Variable                  | Description                         | Default                    |
| ------------------------- | ----------------------------------- | -------------------------- |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name        | `your-project.appspot.com` |
| `NODE_ENV`                | Environment mode                    | `development`              |
| `PORT`                    | Server port                         | `3000`                     |
| `CORS_ORIGIN`             | Allowed CORS origin for development | `http://localhost:3000`    |
| `AUTH_JWT_EXPIRES_IN`     | Backend JWT lifetime (e.g., `15m`)  | `15m`                      |
| `AUTH_JWT_ISSUER`         | Issuer claim for backend JWTs       | `gurucool-ai-backend`      |

### Important Note

When copying the Firebase private key from the JSON file into your `.env` file, make sure to preserve the `\n` characters. The key should be formatted as:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

### Authentication Claims & Backend JWT

- The `/api/auth/token` endpoint exchanges the caller's Firebase ID token for a backend-signed JWT that echoes `uid`, `role`, `schoolId`, and `status`. Configure `AUTH_JWT_SECRET` (required), plus optional `AUTH_JWT_EXPIRES_IN` / `AUTH_JWT_ISSUER`, before calling this route.
- `AuthService` now syncs Firebase custom claims (role, schoolId, status) whenever a profile, role, or school assignment changes. Clients should refresh their Firebase ID token after such updates so the new claims flow through `Authorization` headers.
- The auth middleware trusts those claims first, refreshes them when stale, and blocks suspended accounts globally by returning `{ code: 'ACCOUNT_SUSPENDED' }`.

## Testing

This project uses Firebase emulators for testing. The test setup is configured in the `tests/setup/` directory.

### Available Test Commands

```bash
# For running Firebase emulator
pnpm test:emulator

# For unit testing
pnpm test:unit

# For e2e testing
pnpm test:e2e
```

The test suite will automatically start and stop the Firebase emulators as needed. The emulator configuration is handled by the setup files in `tests/setup/`.

## Firestore Security Rules

- The repository tracks Firestore rules in `firestore.rules` and wires them through `firebase.json`, ensuring CI/CD deployments mirror the same access controls enforced by Express middleware.
- The rules enforce role + school isolation and deny every write from suspended accounts. School admins/teachers only see their own school, while platform admins retain global access.
- Deploy the rules with the Firebase CLI: `firebase deploy --only firestore`. To test locally, run `firebase emulators:start --only firestore` (the Jest suites already spin this up automatically).

## API Endpoints Overview

API endpoints are organized by feature:

- `/api/auth` - Authentication and user management
- `/api/assessments` - Assessment system
- `/api/modules` - Learning modules
- `/api/tutor` - AI tutor chat
- `/api/credentials` - Badges and certificates
- `/api/admin/school` - School administration
- `/api/platform` - Platform administration

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Express middleware
├── repositories/     # Database access layer
├── routes/          # API routes
├── services/        # Business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── prompts/         # AI prompt templates
tests/
├── fixtures/        # Test data
├── integration/     # Integration tests
├── setup/          # Test setup and teardown
└── unit/           # Unit tests
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

ISC

## Maintainer

Contact: durgesh.work.x@gmail.com
