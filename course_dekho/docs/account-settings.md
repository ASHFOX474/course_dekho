# Account settings and recovery

- **Profile → Edit profile:** edit your display name. Learners can also edit department and year of study; contributors can edit department and designation. Username, email, university affiliation, role, and approval status remain protected.
- **Settings → Change password:** enter the current password and confirm a new password of 12–128 characters. Saving revokes every existing session and outstanding recovery link. Sign in again with the new password.
- **Login → Forgot your password?:** contact a CourseDekho administrator using an existing trusted contact channel. Recovery is admin-assisted; no email delivery service is configured.
- **Admin → User directory → All Users → Recovery link:** independently verify the account owner's identity, then enter your admin password. Share the resulting link privately with that person. The owner chooses their new password. The link expires in 30 minutes, works once, and is invalidated if another link is issued.

Another active administrator is needed to recover an admin account using this UI. A sole administrator who loses access needs operator-assisted recovery; the public app does not bypass administrator verification.

## Database and security

Migration `0009_password_recovery.sql` adds `password_reset_token`; run `npm run db:migrate` on other environments before deploying this feature. Existing tables and seed data are preserved. The table stores only a SHA-256 token digest, account/issuer references, expiry and consumption timestamps. The raw link is returned once to the reauthenticated administrator and is not logged or persisted by the application.

The token is carried in the URL fragment, which is not sent to the server, and removed from the address bar after the reset page reads it. Reopen the original link if you refresh the page before completing the reset. Password reset does not approve or reactivate an account.

Password operations lock the user row, update the scrypt hash, consume recovery tokens and revoke sessions in a single transaction. Login rechecks the verified password hash under the same user-row lock before creating a session, preventing an old password from winning a concurrent reset. Profile writes derive identity and editable fields from the authenticated session. Mutations validate the request origin, and responses use `no-store`.

## Verification

- `npm test` includes account authorization, forged profile fields, current-password failures, stale-login rejection, and cookie behavior.
- `node scripts/db/verify-accounts.mjs` checks profile persistence for every role, session revocation, old/new login, recovery replacement, expiry and single use against PostgreSQL. All test data is rolled back; identity sequence counters can advance.
- `scripts/ui/verify-workspaces.mjs` includes profile forms, password confirmation/change, admin recovery-link creation, and fragment-token reset with intercepted API fixtures.
- `npm run lint -- --ignore-pattern '.data/**'`, `npx tsc --noEmit --incremental false`, and `npm run build` verify source and build output.
