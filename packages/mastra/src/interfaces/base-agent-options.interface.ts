import type { AgentConfig } from "@mastra/core/agent";

export type BaseAgentConfig = Omit<AgentConfig, "id"> & {
  id?: string;
};
