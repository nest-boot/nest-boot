import type { Config } from "jest";

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".spec.ts$",
  transform: {
    "^.+.(t|j)s$": "ts-jest",
  },
  coverageDirectory: "./coverage",
  collectCoverageFrom: ["src/**/*"],
  coveragePathIgnorePatterns: ["/packages/request-context/"],
  testEnvironment: "node",
} satisfies Config;
