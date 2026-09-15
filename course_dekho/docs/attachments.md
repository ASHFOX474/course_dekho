Submission attachments
======================

Use Contributor > My Submissions > New Submission > Attach file, or enter an
HTTP(S) link such as a Google Drive sharing link. One attachment up to 20 MB is
supported per submission. A file and link can be supplied together. Text-only
submissions remain supported. Drive permissions are managed by the file owner.

The admin can open the attachment in Material Approvals before approving it.
After approval, learners can open the resource from its course/topic and use
the Preview section to view PDFs/images, download other files, or open the link.
Pending and rejected uploads are accessible only to their contributor and admins.

Files are stored privately in `.data/uploads`, excluded from Git, using generated
keys. Existing content_submission and content_revision columns store metadata;
no migration is required. The existing approval transaction copies this metadata.
Never move uploads into `public`, which would bypass approval checks.

Optional UPLOAD_DIR configures a persistent directory. Back up this directory
alongside PostgreSQL. This local-storage implementation needs a persistent,
writable server disk. A Vercel/serverless deployment needs an external storage
implementation before using direct uploads; Google Drive links do not need local
file storage. No cloud storage account or dependency is configured by this change.

Focused automated checks:

    node --test --experimental-test-isolation=none tests/characterization/attachments.test.mjs

Manual acceptance: submit a PDF and Drive link as a contributor; open them in
admin review; confirm the pending resource cannot be accessed by a learner;
approve, then view/download as a learner. Also check a rejected submission,
an invalid extension, an empty file, and a file over 20 MB.
