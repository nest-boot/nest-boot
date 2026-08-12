import type { Config } from "jest";

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".spec.ts$",
  transform: {
    "^.+.(t|j)s$": "ts-jest",
  },
  coverageDirectory: "./coverage",
  collectCoverageFrom: ["src/request-context.interceptor.ts"],
  coveragePathIgnorePatterns: [
    "/packages/request-context/src/(?!request-context\\.interceptor\\.ts$)",
  ],
  testEnvironment: "node",
} satisfies Config;
