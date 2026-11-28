---
"@nest-boot/storage": minor
---

Add `StorageService.isTemporaryFile()` to recognize a storage-relative temporary
key or this bucket's presigned temporary resource URL.
Temporary upload forms, preview URLs, and signed download links now default to
a 24-hour lifetime.
