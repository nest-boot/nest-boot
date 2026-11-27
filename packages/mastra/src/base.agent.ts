import { Agent as MastraAgent, type AgentConfig } from "@mastra/core/agent";
import { kebabCase } from "lodash-es";

import { wrapAgentToolDiscovery } from "./tool-guard.js";

export type BaseAgentConfig = Omit<AgentConfig, "id"> & {
  id?: string;
};

/**
 * Base NestJS-injectable Mastra agent that automatically derives its `id`
 * from the concrete subclass name in kebab-case unless explicitly overridden,
 * and filters exposed tools through NestJS authorization guards.
 */
export abstract class BaseAgent extends MastraAgent {
  constructor(config: BaseAgentConfig) {
    super({
      ...config,
      id: config.id ?? kebabCase(new.target.name),
    });
    wrapAgentToolDiscovery(this);
  }
}
