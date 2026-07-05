# Factory Tracker — Setup

## What changed from the old "citiprints-job-tracker"
- **Auth is now resolved server-side** (`src/lib/session.ts` → `getCurrentUser()`), called once
  in `layout.tsx`. This is the fix for the entire redirect-loop / flashing-header saga in the
  old git history — there is no more client-side `fetch("/api/auth/me")` + `useEffect` dance.
- Added `src/middleware.ts` for fast route protection (redirects to `/signin` if there's no
  session cookie at all; the *real* verification still happens server-side).
- Removed `/authverification` and the old client-side redirect chain in `page.tsx` / `signin/page.tsx`.
- Extended `prisma/schema.prisma` with `Location`, `AttendanceLog`, `Shift`, `PushSubscription`,
  `Notification` models.
- Added `/attendance` (clock in/out with geofence check) and `/schedule` (admin assigns shifts,
  workers confirm) pages + their API routes.
- `src/lib/notify.ts` creates in-app notifications now; push (Firebase) is stubbed and ready to
  wire in once you have FCM credentials — see the comment in that file.
- Fixed the Prisma `binaryTargets` so it can actually deploy to Linux (Vercel), not just your Mac.

## First-time setup

1. **Create a Neon Postgres project** at https://neon.tech (free tier is plenty for 25 users).
   Copy the pooled connection string.

2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` with that string.

3. Install dependencies:
   ```bash
   npm install
   ```
   (`postinstall` runs `prisma generate` automatically.)

4. Push the schema to your new database:
   ```bash
   npx prisma db push
   ```

5. Run locally:
   ```bash
   npm run dev
   ```

6. Create your first admin user — easiest way for now is directly via Prisma Studio:
   ```bash
   npx prisma studio
   ```
   Create a `User` row with `role: "ADMIN"`, and a bcrypt-hashed password (or temporarily
   register via `/signup` then flip the role to ADMIN in Studio).

7. Add your locations (T Nagar, Mylapore, Citiprints factory) via `POST /api/locations` as
   an admin, or directly in Prisma Studio — this is what powers the attendance geofence.

## Deploying
- Push this to a GitHub repo, import it into Vercel, add the same env vars there.
- Vercel will build fine with the `rhel-openssl-3.0.x` / `debian-openssl-3.0.x` binary targets
  already set in the schema — no changes needed.

## Not yet built (next steps we discussed)
- Push notifications: needs Firebase project + service account creds in `.env`, then filling in
  the `sendPushBestEffort` stub in `src/lib/notify.ts`.
- PWA installability (manifest.json referenced in layout.tsx doesn't exist yet — add icons +
  manifest if you want "Add to Home Screen" on workers' phones).
- Selfie-at-clock-in verification (optional, if buddy-punching turns out to be a real risk).
