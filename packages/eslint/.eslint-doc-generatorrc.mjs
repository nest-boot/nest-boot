import prettier from "prettier";

/** @type {import("eslint-doc-generator").GenerateOptions} */
const config = {
  configEmoji: [
    ["recommended", "✅"],
    ["rules", "🧩"],
    ["standard", "📐"],
  ],
  ruleDocSectionInclude: ["Examples"],
  postprocess: async (content, filePath) => {
    const options = await prettier.resolveConfig(filePath, {
      editorconfig: true,
    });
    return prettier.format(content, { ...options, filepath: filePath });
  },
};

export default config;
