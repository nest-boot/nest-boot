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
  plugins: ["@nest-boot", "simple-import-sort"],
  rules: {
    "no-void": "off",
    "no-use-before-define": "off",

    // 导入排序
    "import/order": "off",
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",

    // 总是使用 return await
    "@typescript-eslint/return-await": ["error", "always"],

    "@typescript-eslint/restrict-plus-operands": "error",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "@typescript-eslint/no-extraneous-class": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-function": [
      "error",
      { allow: ["constructors"] },
    ],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

    "@nest-boot/entity-constructor": "error",
    "@nest-boot/entity-property-no-optional-or-non-null-assertion": "error",
    "@nest-boot/entity-property-nullable": "error",
    "@nest-boot/graphql-resolver-method-return-type": "error",
    "@nest-boot/entity-property-field": "error",
  },
  parserOptions: {
    sourceType: "module",
    project: true,
  },
};
