import { Agent as MastraAgent, type AgentConfig } from "@mastra/core/agent";
import { kebabCase } from "lodash-es";

export type BaseAgentConfig = Omit<AgentConfig, "id"> & {
  id?: string;
};

/**
 * Base NestJS-injectable Mastra agent that automatically derives its `id`
 * from the concrete subclass name in kebab-case unless explicitly overridden.
 */
export abstract class BaseAgent extends MastraAgent {
  constructor(config: BaseAgentConfig) {
    super({
      ...config,
      id: config.id ?? kebabCase(new.target.name),
    });
  }
}
