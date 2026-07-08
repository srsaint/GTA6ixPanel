# License Admin Backend

Public-hostable Next.js + Neon Postgres license server with admin login, reseller referral keys, license generation, device binding, and extension verification.

## Features

- Owner bootstrap account setup.
- Admin login with secure HTTP-only JWT cookie.
- Referral keys that let resellers create admin accounts.
- Owner-controlled reseller limits for license duration and total generated licenses.
- License key generation with expiration, max devices, notes, ban/unban, and device reset.
- Public `POST /api/license/verify` endpoint for browser extensions or apps.
- Server-side hashing for license keys, referral keys, device IDs, IPs, and user agents.

## Environment

Copy `.env.example` to `.env` locally and set the same values in Vercel project environment variables.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/license_admin?sslmode=require"
JWT_SECRET="replace-with-a-long-random-secret"
LICENSE_PEPPER="replace-with-a-different-long-random-secret"
ADMIN_BOOTSTRAP_TOKEN="replace-with-a-one-time-owner-setup-token"
LICENSE_SESSION_HOURS="24"
```

Use long random values for `JWT_SECRET`, `LICENSE_PEPPER`, and `ADMIN_BOOTSTRAP_TOKEN`. Do not reuse them.

## Local Setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000/setup-owner` and create the first owner account with `ADMIN_BOOTSTRAP_TOKEN`.

## Neon + Vercel Setup

1. Create a Neon Postgres project.
2. Copy the pooled connection string into `DATABASE_URL`.
3. Import this folder into Vercel as a Next.js app.
4. Add all variables from `.env.example` to Vercel environment variables.
5. Run `npx prisma db push` locally against the Neon `DATABASE_URL`, or run it from a trusted CI/deployment step.
6. Deploy on Vercel.
7. Visit `https://your-domain.vercel.app/setup-owner` once to create the owner account.

## Extension Verification

Call this from a legitimate extension or app backend flow:

```http
POST /api/license/verify
Content-Type: application/json

{
  "key": "LIC-XXXXX-XXXXX-XXXXX-XXXXX",
  "deviceId": "random-install-id-stored-locally"
}
```

Successful response:

```json
{
  "ok": true,
  "verifiedUntil": 1720000000000,
  "expiresAt": 1720600000000,
  "licenseStatus": "ACTIVE"
}
```

Common error codes:

- `invalid_key`
- `expired`
- `banned`
- `device_limit`
- `rate_limited`

## Browser Device Binding

Browser extensions cannot safely read real hardware IDs. Generate a random install ID once, store it locally, and send that as `deviceId`. The backend hashes and binds it to the license.

Example:

```js
async function getDeviceId() {
  const existing = localStorage.getItem("deviceId");
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  localStorage.setItem("deviceId", id);
  return id;
}
```

## Admin Flow

- Owner creates referral keys from `/admin`.
- Reseller uses `/register-admin` with the referral key.
- Reseller can create licenses within invite limits.
- Owner can see all licenses and referral keys.
- Resellers can see only their generated licenses.

## Notes

- Generated license and referral keys are shown only once. The database stores hashes, not plaintext keys.
- Keep `LICENSE_PEPPER` stable. Changing it invalidates lookups for existing hashed keys.
- This backend is intended for legitimate licensing and access control only.
