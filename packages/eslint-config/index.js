module.exports = {
  env: {
    node: true,
  },
  extends: [
    "standard",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "prettier",
  ],
  plugins: ["simple-import-sort"],
  rules: {
    "@typescript-eslint/restrict-plus-operands": "error",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-extraneous-class": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-void": "off",
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "import/order": "off",
  },
  parserOptions: {
    sourceType: "module",
    project: true,
  },
};
