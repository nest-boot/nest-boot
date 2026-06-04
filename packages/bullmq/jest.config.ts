import type { Config } from "jest";

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".spec.ts$",
  transform: {
    "^.+.(t|j)s$": "ts-jest",
  },
  coverageDirectory: "./coverage",
  collectCoverageFrom: ["src/**/*"],
  moduleNameMapper: {
    "^@nest-boot/request-context$": "<rootDir>/../request-context/src",
  },
  testEnvironment: "node",
} satisfies Config;
