import config from "./app.json" with { type: "json" };

it("declares the app preset", () => {
  expect(config).toEqual({
    $schema: "https://json.schemastore.org/tsconfig",
    display: "App",
    extends: "./base.json",
    compilerOptions: {
      rootDir: "${configDir}",
      paths: {
        "@/*": ["${configDir}/src/*"],
      },
    },
    include: [
      "${configDir}/src",
      "${configDir}/test",
      "${configDir}/vitest.config.ts",
    ],
    exclude: ["${configDir}/node_modules", "${configDir}/dist"],
  });
});
