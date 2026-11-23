---
"@nest-boot/mastra": minor
---

Add `@nest-boot/mastra` for NestJS-native Mastra integration with injectable `BaseAgent`, `BaseTool`, `BaseStep`, and `BaseWorkflow` base classes, singleton provider auto-discovery, Express 5-compatible `/api/mastra` HTTP API protected by `@Can("manage", Mastra)`, embedded Mastra Studio middleware at `/api/mastra/studio`, and environment-driven PostgreSQL (`MASTRA_DATABASE_URL ?? DATABASE_URL`) / ClickHouse (`MASTRA_CLICKHOUSE_URL`) storage and observability defaults.
