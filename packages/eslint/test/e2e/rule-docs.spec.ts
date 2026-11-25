import { readFileSync } from "node:fs";
import path from "node:path";

import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";

import nestBoot, { rules } from "../../src/index.js";

const packageRoot = path.resolve(import.meta.dirname, "../..");
const linter = new Linter();

/**
 * Extracts fenced TypeScript code blocks grouped under `### Incorrect` and `### Correct` headings.
 * @param markdown - Markdown source of a rule documentation page.
 * @returns Extracted `valid` and `invalid` code snippets.
 */
function extractDocExamples(markdown: string): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  let section: "valid" | "invalid" | null = null;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of markdown.split("\n")) {
    if (!inCodeBlock) {
      if (/^###\s+.*\bIncorrect\b/i.test(line)) {
        section = "invalid";
      } else if (/^###\s+.*\bCorrect\b/i.test(line)) {
        section = "valid";
      } else if (/^##\s+/.test(line)) {
        section = null;
      } else if (/^```(?:ts|typescript)\s*$/.test(line) && section !== null) {
        inCodeBlock = true;
        codeLines = [];
      }
    } else if (/^```\s*$/.test(line)) {
      inCodeBlock = false;
      const snippet = codeLines.join("\n").trim();
      if (snippet) {
        (section === "valid" ? valid : invalid).push(snippet);
      }
    } else {
      codeLines.push(line);
    }
  }

  return { valid, invalid };
}

describe("rule documentation examples", () => {
  for (const [ruleName, ruleModule] of Object.entries(rules)) {
    const docPath = path.join(packageRoot, "docs/rules", `${ruleName}.md`);
    const ruleId = `nest-boot/${ruleName}`;
    const config: Linter.Config[] = [
      {
        files: ["**/*.ts"],
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            disallowAutomaticSingleRunInference: true,
            projectService: {
              allowDefaultProject: ["doc-example.ts"],
              defaultProject: "tsconfig.json",
            },
            tsconfigRootDir: packageRoot,
          },
        },
        plugins: { "nest-boot": nestBoot },
        rules: { [ruleId]: "error" },
      },
    ];

    describe(`docs/rules/${ruleName}.md`, () => {
      const markdown = readFileSync(docPath, "utf8");
      const { valid, invalid } = extractDocExamples(markdown);
      const filename = path.join(packageRoot, "doc-example.ts");

      it("contains both Correct and Incorrect TypeScript examples", () => {
        expect(valid.length).toBeGreaterThan(0);
        expect(invalid.length).toBeGreaterThan(0);
      });

      it.each(valid)("accepts Correct example %#", (code) => {
        const messages = linter.verify(code, config, { filename });
        expect(messages).toEqual([]);
      });

      it.each(invalid)(
        "reports (and converges autofixes for) Incorrect example %#",
        (code) => {
          const messages = linter.verify(code, config, { filename });
          expect(messages.length).toBeGreaterThan(0);
          expect(messages.every((msg) => msg.ruleId === ruleId)).toBe(true);

          if (ruleModule.meta.fixable) {
            const fixed = linter.verifyAndFix(code, config, { filename });
            expect(fixed.fixed).toBe(true);
            expect(fixed.messages).toEqual([]);
          }
        },
      );
    });
  }
});
