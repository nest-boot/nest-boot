---
"@nest-boot/mastra": minor
"@nest-boot/auth": minor
---

Add NestJS Guard authorization and exposure-time filtering for Mastra tools:

- `@nest-boot/mastra`: Automatically discover singleton `BaseTool` and Mastra `Tool` providers in `MastraManager`, bind NestJS execution-time guards (`MASTRA_TOOL_EXECUTION_CONTEXT_TYPE = "mastra:tool:execution"`) and exposure-time discovery guards (`MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE = "mastra:tool:discovery"`) via `ExternalContextCreator`, automatically filter unauthorized tools in `BaseAgent` / `Agent.listTools()` and Mastra HTTP tool/agent endpoints, conceal injected DI dependencies and project serialized tool metadata, and add `getTools`, `getTool`, `getToolByRegistrationKey`, `canAccessTool`, `getAccessibleTools`, and `filterAccessibleTools`.
- `@nest-boot/auth`: Support Mastra discovery (`mastra:*:discovery`) and execution (`mastra:*:execution`) contexts in `AuthGuard`, enforcing authentication and static `@Can` rules during exposure-time filtering while forwarding validated tool input and execution context to dynamic `@Can` callbacks at execution time.
