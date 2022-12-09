module.exports = {
  env: {
    node: true,
  },
  extends: ["standard-with-typescript", "prettier"],
  plugins: ["simple-import-sort"],
  rules: {
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "import/order": "off",
    "import/newline-after-import": "error",
  },
  parserOptions: {
    sourceType: "module",
  },
};
