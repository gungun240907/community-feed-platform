# Firebase Phone Authentication — Setup Guide

This guide walks you through enabling real SMS OTP phone sign-in for **DevFeed**.

The code is already implemented and fully tested (see `tests/firebase.test.js`). It reads
everything from environment variables, so **once you complete this guide, no code changes
are needed** — just restart the app.

- Frontend: `src/utils/firebaseClient.js` — sends the OTP via Firebase and returns an ID token.
- Backend: `src/server/utils/firebaseAdmin.js` — verifies the ID token with the Firebase Admin SDK
  (the client is never trusted).
- Flow: user enters phone → Firebase reCAPTCHA → SMS OTP → user enters code → client gets a
  Firebase ID token → `POST /api/auth/firebase-login` verifies it → creates/links the user →
  sets an httpOnly JWT cookie → redirects to `/`.

> **Cost:** Phone Authentication is NOT free. You need a **Blaze (pay-as-you-go)** plan.
> SMS costs roughly **US$0.07 per message in India** (see
> [Firebase pricing](https://firebase.google.com/pricing)). Use the fictional test numbers in
> Part 1 step 6 to test **without sending SMS or spending money**.

---

## Part 1 — Firebase Console configuration

### 1. Create a Firebase project
1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Follow the wizard (you can skip Google Analytics).
3. Note the **Project ID** — you'll use it in several env vars.

### 2. Upgrade to the Blaze plan
1. In the Firebase console: **Build > Authentication**.
2. If prompted, click **Upgrade project** and link a Google Cloud billing account.
   Phone Authentication requires the Blaze plan.

### 3. Add a Web app (to get the client config)
1. In Project settings (gear icon) > **Your apps**, click the **Web** icon (or **Add app > Web**).
2. Nickname it `devfeed` and click **Register app**.
3. Keep the page open — copy the values Firebase shows (apiKey, authDomain, projectId,
   storageBucket, messagingSenderId, appId). These are the **public web-app config** values
   for the `NEXT_PUBLIC_FIREBASE_*` env vars (see Part 2). They are safe to expose.

### 4. Enable the Phone sign-in provider
1. In the Firebase console, go to **Build > Authentication > Sign-in method**.
2. Find **Phone** and click the **Enable** toggle (default is disabled).
3. Click **Save**.

### 5. Configure the SMS region policy (required for new projects)
For **new** projects the default SMS region policy allows **no regions**, so no SMS is ever sent
until you change this.

1. Go to **Build > Authentication > Settings** (or the **SMS region policy** section on the
   **Sign-in method** tab).
2. In **SMS region policy**, choose **Allow** and add the regions you will serve. For India use
   `IN`; for the USA `US`. You can allow multiple regions.
3. Save.

### 6. (Recommended) Add fictional test phone numbers
Fictional numbers let you test the full flow **without sending real SMS**, using your quota, or
getting throttled.

1. In **Authentication > Sign-in method**, expand **Phone numbers for testing**.
2. Add a fictional E.164 number (e.g. `+1 650-555-3434`) and a 6-digit code of your choice
   (e.g. `654321`). Pick numbers that are hard to guess.
3. When you sign in with a test number, no SMS is sent — you just enter the code you configured.

> You can add up to 10 test numbers. Never use a real number you don't own as a test number.

### 7. Authorize your app's domains
Phone auth validates the page's hostname against **Authorized domains**. This is the most common
source of "doesn't work" bugs.

1. Go to **Build > Authentication > Settings > Authorized domains**.
2. Click **Add domain** and add each of these (one at a time):
   - `127.0.0.1` — required for local development (see the localhost note below).
   - Your Vercel domain, e.g. `client-eight-sigma-47.vercel.app` (no `https://`, no port).
3. The console may show a warning when you add `127.0.0.1`; it still saves — click **Add**.

> **Important — `localhost` is NOT supported.** Firebase intentionally disallows phone auth from
> `localhost` (a 2024 security policy change; errors like `auth/invalid-app-credential` or
> `Hostname match not found`). For local development, **open the site at `http://127.0.0.1:3000`**
> instead of `http://localhost:3000`.

### 8. reCAPTCHA (only if you see an error about it)
Firebase's `RecaptchaVerifier` auto-provisions the reCAPTCHA keys — **no manual site key is
needed** in code. However, some **new** projects must enable **reCAPTCHA Enterprise** in Google
Cloud before phone auth works. If sign-in fails with `auth/recaptcha-not-enabled`:

1. Go to the [Google Cloud console](https://console.cloud.google.com) and select your project.
2. Enable the **reCAPTCHA Enterprise API** for the project.
3. No keys need to be created manually — Firebase provisions them.

### 9. Create the service account (for the backend Admin SDK)
The backend verifies ID tokens, which requires a service-account key. It is a **secret** and must
never be committed or exposed to the browser.

1. In the Firebase console, go to **Project settings (gear) > Service accounts**.
2. Click **Generate new private key** and confirm.
3. A file named `serviceAccountKey.json` downloads — this is the **only secret** you need from
   Firebase.
4. Keep it **out of the repository** (`.gitignore` already excludes it). Either:
   - store its path in `FIREBASE_PRIVATE_KEY_FILE` (recommended for local dev), or
   - copy its `project_id`, `client_email`, and `private_key` into the individual env vars
     (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).

### 10. (Recommended) Restrict your Web API key
To reduce abuse, restrict the public API key to your domains:

1. In the [Google Cloud console](https://console.cloud.google.com) > **APIs & Services >
   Credentials**, edit the API key named for your Firebase web app.
2. Under **Website restrictions**, add `http://127.0.0.1:3000` and your Vercel domain.
3. Save. (If you restrict the key, you must allow every domain the app runs on.)

---

## Part 2 — Environment variables

All secrets are loaded from environment variables only. **Nothing is hardcoded.** Full reference:
`client/.env.example`.

### Frontend (public web-app config — safe to expose)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy*****************************
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef
```

### Backend (SECRET — server only)

Option A — individual values (paste the raw JSON string; keep the `\n` escapes):

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

Option B — point at the downloaded service-account file (easiest for local dev):

```bash
FIREBASE_PRIVATE_KEY_FILE=C:\path\to\serviceAccountKey.json
```

### Where to put them

- **Local:** create/edit `client/.env` (already git-ignored). `npm run dev` loads it via dotenv.
  Frontend and backend vars go in the same file.
- **Vercel:** add **all** variables to the Vercel project's Environment Variables for both
  **Preview** and **Production**. `NEXT_PUBLIC_*` values must exist at **build time** (they are
  inlined into the bundle), so set them before each build/deploy.
  The service-account key can be pasted as `FIREBASE_PRIVATE_KEY` (with literal `\n`) or uploaded
  as a file referenced by `FIREBASE_PRIVATE_KEY_FILE`.

> **Never commit** `serviceAccountKey.json`, `.env`, or `FIREBASE_PRIVATE_KEY`.
> `.gitignore` already excludes them (`.env*` and `serviceAccountKey.json` / `*service-account*.json`).

---

## Part 3 — Local test run

1. Make sure MongoDB is running and `client/.env` has your MONGO_URI.
2. Start the app (the Express API runs inside Next.js):
   ```bash
   npm run dev
   ```
3. Open **`http://127.0.0.1:3000`** — **not** `http://localhost:3000`.
4. Go to the **Login** page → **Phone** tab.
5. Enter a fictional test number (e.g. `+1 650-555-3434`). Firebase renders an invisible
   reCAPTCHA and (for a test number) no SMS is sent.
6. Enter the 6-digit code you configured for that number.
7. You are redirected to `/`. Check the database: the `User` doc has `firebaseUid`,
   `isVerified: true`, and `lastLogin`; a `Session` (loginMethod `firebase`) and a `LoginLog`
   (method `firebase_phone`) are persisted.

To test with a real phone and a real SMS, first remove that number from the "Phone numbers for
testing" list and confirm the region is allowed in the SMS region policy. Real SMS costs money.

---

## Part 4 — Vercel deployment

No code changes are needed. Steps:

1. Set all env vars from Part 2 in Vercel (Preview + Production). Remember `NEXT_PUBLIC_*` at
   build time.
2. Add your Vercel domain (`your-app.vercel.app`) to **Authentication > Settings >
   Authorized domains** (Part 1 step 7).
3. Ensure the web API key restriction (Part 1 step 10), if applied, includes the Vercel domain.
4. Deploy. Phone auth will use the real Firebase ID tokens automatically.

---

## Security notes (already implemented)

- The server verifies every ID token with the **Firebase Admin SDK** (`verifyIdToken`, checking
  revocation). The client is never trusted — a forged token is rejected with `401`.
- The service-account private key exists only in the server environment / an uncommitted file.
- Sessions are server-side (Mongo `Session` docs) with a JWT in an **httpOnly** + SameSite cookie;
  every login is recorded in `LoginLog`.
- `/api/auth/firebase-login` is rate-limited and body-validated with **zod**.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `auth/invalid-app-credential`, `auth/captcha-check-failed`, or `Hostname match not found` | You're on `localhost`, or the domain isn't in **Authorized domains**. Open `http://127.0.0.1:3000` and add `127.0.0.1` (and your Vercel domain) to Authorized domains. |
| `auth/operation-not-allowed` | Phone provider not enabled, SMS region policy allows no regions, or project not on Blaze. See Part 1 steps 2, 4, 5. |
| `auth/quota-exceeded` | Too many real SMS sends / number throttled. Use a fictional test number. |
| `auth/recaptcha-not-enabled` | Enable the reCAPTCHA Enterprise API in Google Cloud (Part 1 step 8). |
| Backend returns `503 {"code":"FIREBASE_NOT_CONFIGURED"}` on `/api/auth/firebase-login` | `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + (`FIREBASE_PRIVATE_KEY` or `FIREBASE_PRIVATE_KEY_FILE`) not set on the server. |
| Backend returns `401 {"code":"INVALID_FIREBASE_TOKEN"}` | The ID token failed Admin SDK verification (expired, revoked, or forged). Re-sign-in on the client. |
| reCAPTCHA badge doesn't appear | The invisible verifier resolves silently; it only shows a badge in some cases. If nothing happens, check the browser console for a Firebase error and confirm you opened `127.0.0.1`, not `localhost`. |
