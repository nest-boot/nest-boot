import type { Config } from "jest";

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".spec.ts$",
  transform: {
    "^.+.(t|j)s$": "ts-jest",
  },
  coverageDirectory: "./coverage",
  collectCoverageFrom: ["src/**/*"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testEnvironment: "node",
} satisfies Config;
