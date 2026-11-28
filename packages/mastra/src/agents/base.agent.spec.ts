import { Agent as MastraAgent } from "@mastra/core/agent";
import { Can } from "@nest-boot/auth";

import { BaseAgent } from "./base.agent.js";

class BillingLedger {}

describe("BaseAgent", () => {
  it("derives kebab-case id from the concrete subclass name unless explicitly overridden", () => {
    class ArticleReviewerAgent extends BaseAgent {
      constructor() {
        super({
          name: "Article Reviewer",
          instructions: "Review articles.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    class CustomIdAgent extends BaseAgent {
      constructor() {
        super({
          id: "custom-seo-agent",
          name: "Custom SEO",
          instructions: "Review SEO.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    const derived = new ArticleReviewerAgent();
    const custom = new CustomIdAgent();

    expect(derived).toBeInstanceOf(BaseAgent);
    expect(derived).toBeInstanceOf(MastraAgent);
    expect(derived.id).toBe("article-reviewer-agent");
    expect(custom.id).toBe("custom-seo-agent");
  });

  it("installs locked @Can discovery wrappers on BaseAgent subclasses and __fork() clones", async () => {
    @Can("manage", BillingLedger)
    class ProtectedSubAgent extends BaseAgent {
      constructor() {
        super({
          name: "Protected SubAgent",
          instructions: "Protected.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    const protectedSubAgent = new ProtectedSubAgent();
    const forkedProtectedSubAgent = (
      protectedSubAgent as unknown as { __fork: () => MastraAgent }
    ).__fork();

    class PrototypeOverrideAgent extends BaseAgent {
      constructor() {
        super({
          name: "Prototype Override Agent",
          instructions: "Overrides listAgents via prototype method.",
          model: "openai/gpt-4o-mini",
        });
      }

      override listAgents() {
        return Promise.resolve({
          forkedBilling: forkedProtectedSubAgent,
        });
      }
    }

    const agent = new PrototypeOverrideAgent();
    expect(Object.keys(await agent.listAgents())).toEqual([]);

    class FieldOverrideAgent extends BaseAgent {
      constructor() {
        super({
          name: "Field Override Agent",
          instructions:
            "Attempts to replace locked listAgents via class field.",
          model: "openai/gpt-4o-mini",
        });
      }

      override listAgents = () =>
        Promise.resolve({
          forkedBilling: forkedProtectedSubAgent,
        });
    }

    expect(() => new FieldOverrideAgent()).toThrow(TypeError);
  });
});
