import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ESLint } from "eslint";
import config from "@nest-boot/eslint-config";

const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
const source = readFileSync("documented.ts", "utf8");
const [valid] = await eslint.lintText(source, { filePath: "documented.ts" });
assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages));
const [invalid] = await eslint.lintText(
  source.replace("@param value", "@param missing"),
  { filePath: "documented.ts" },
);
assert(
  invalid.messages.some(({ ruleId }) => ruleId === "jsdoc/check-param-names"),
);
console.log(
  "Packed ESLint config accepts valid JSDoc and rejects invalid parameter names",
);
