import { Agent as MastraAgent, type AgentConfig } from "@mastra/core/agent";
import { kebabCase } from "lodash-es";

import { wrapAgentDiscovery } from "./agent-discovery.js";

export type BaseAgentConfig = Omit<AgentConfig, "id"> & {
  id?: string;
};

/**
 * Base NestJS-injectable Mastra agent that automatically derives its `id`
 * from the concrete subclass name in kebab-case unless explicitly overridden,
 * and filters discovered tools, sub-agents, and workflows through `@Can(...)` metadata.
 */
export abstract class BaseAgent extends MastraAgent {
  constructor(config: BaseAgentConfig) {
    super({
      ...config,
      id: config.id ?? kebabCase(new.target.name),
    });
    wrapAgentDiscovery(this);
  }
}
