import type { Config } from "jest";

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".spec.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm/jose@[^/]+/node_modules/jose|jose)/)",
  ],
  coverageDirectory: "./coverage",
  collectCoverageFrom: ["src/**/*"],
  testEnvironment: "node",
} satisfies Config;
