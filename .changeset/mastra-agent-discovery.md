---
"@nest-boot/mastra": minor
---

Add `@Can`-based agent capability discovery filtering and `Tool` provider auto-discovery in `@nest-boot/mastra`:

- Automatically discover singleton `BaseTool` and Mastra `Tool` providers in `MastraManager` (`getTools`, `getTool`) and conceal constructor-injected DI properties from Mastra object serializers.
- Automatically filter `@Can(...)`-protected tools, sub-agents, and workflows in `BaseAgent` (and `MastraManager`-registered `Agent` instances) across `listTools()`, `listAgents()`, and `listWorkflows()` (including `__fork()` clones and recursive sub-agents), while leaving unannotated primitives and direct NestJS internal invocations unrestricted.
