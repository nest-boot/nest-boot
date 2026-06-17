import type { Config } from "jest";

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".spec.ts$",
  transform: {
    "^.+.(t|j)s$": "ts-jest",
  },
  moduleNameMapper: {
    "^lodash-es/(.*)\\.js$": "lodash/$1",
  },
  coverageDirectory: "./coverage",
  collectCoverageFrom: ["src/**/*"],
  testEnvironment: "node",
} satisfies Config;
