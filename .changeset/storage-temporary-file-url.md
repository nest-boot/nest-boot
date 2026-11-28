---
"@nest-boot/storage": minor
---

Add `StorageService.isTemporaryFileUrl()` so applications can distinguish their
presigned temporary URLs from external links before promoting files.
Temporary upload forms, preview URLs, and signed download links now default to
a 24-hour lifetime.
