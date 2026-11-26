import prettier from "prettier";

/** @type {import("eslint-doc-generator").GenerateOptions} */
const config = {
  configEmoji: [["recommended", "✅"]],
  ruleDocSectionInclude: ["Examples"],
  postprocess: async (content, filePath) => {
    const normalized = content.replaceAll(
      "| `[object Object]` |",
      '| `{ HideField: "remove", OneToOne: "remove", OneToMany: "remove", ManyToOne: "remove", ManyToMany: "remove" }` |',
    );
    const options = await prettier.resolveConfig(filePath, {
      editorconfig: true,
    });
    return prettier.format(normalized, { ...options, filepath: filePath });
  },
};

export default config;
