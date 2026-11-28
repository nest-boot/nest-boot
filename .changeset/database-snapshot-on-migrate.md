---
"@nest-boot/database": patch
---

Default `migrations.snapshotOnMigrate` to `false` so applying migrations (`nb database migration up`) against ephemeral or environment-named databases does not write `.snapshot-<dbName>.json` files into the source tree, while `nb database migration create` continues to manage schema snapshots.
