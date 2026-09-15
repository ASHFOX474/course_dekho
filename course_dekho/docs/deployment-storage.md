Deployment storage preparation
==============================

The current application uses PostgreSQL for file metadata and private server disk
for file bytes. No schema changes are needed for persistent storage.

Local or persistent-server hosting
----------------------------------

Set UPLOAD_DIR to an absolute private directory on persistent disk, outside the
public web root. The default for development is `.data/uploads`. Back up that
directory together with PostgreSQL. Every application instance must access the
same storage. Retain the files when replacing the application during deployment.

Set DATABASE_URL and APP_ORIGIN through the host's environment settings. Do not
commit credentials. Validate with `npm run lint`, `npm test`, and `npm run build`.
The repeatable database acceptance check is `node scripts/db/verify-workflows.mjs`;
see workflow-verification.md for its rollback behavior and prerequisites.

Vercel or other ephemeral/serverless hosting
-------------------------------------------

Direct uploads are not ready for this deployment model. A private external object
store must replace local file operations. Do not use a public bucket: pending and
rejected files must stay private. Keep ownership and publication checks in the
attachment API. Validate files before associating them with a submission, and
preserve cleanup when submission creation fails.

The provider choice, account and credentials have not been supplied. No external
storage account has been created and no deployment has been performed. Provider
request-size limits must be checked when implementing upload transport; large
files may require direct-to-storage uploads with server-authorized finalization.
Existing local files will need a verified copy to the chosen store before switching.
