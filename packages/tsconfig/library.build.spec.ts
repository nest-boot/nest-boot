import config from "./library.build.json" with { type: "json" };

it("declares the library build preset", () => {
  expect(config).toEqual({
    $schema: "https://json.schemastore.org/tsconfig",
    display: "Library Build",
    extends: "./library.json",
    compilerOptions: {
      rootDir: "${configDir}/src",
      outDir: "${configDir}/dist",
    },
    include: ["${configDir}/src/**/*"],
    exclude: [
      "${configDir}/node_modules",
      "${configDir}/dist",
      "${configDir}/test",
      "${configDir}/**/*.spec.ts",
      "${configDir}/**/*.spec-d.ts",
    ],
  });
});
