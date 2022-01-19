module.exports = {
  env: {
    node: true,
    jest: true,
  },
  root: true,
  extends: [
    "airbnb-base",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:import/typescript",
  ],
  plugins: ["simple-import-sort"],
  rules: {
    "class-methods-use-this": "off",
    "no-useless-constructor": "off",

    // import sort
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",

    // import
    "import/no-cycle": "off",
    "import/export": "off",
    "import/prefer-default-export": "off",
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        ts: "never",
      },
    ],
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: true,
        peerDependencies: true,
        optionalDependencies: true,
      },
    ],

    // class member ordering
    "@typescript-eslint/member-ordering": "error",

    // no use before define
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": "error",

    // no shadow
    "no-shadow": "off",
    "@typescript-eslint/no-shadow": "error",

    // no return await
    // https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/returningpromises.md
    "no-return-await": "off",
    "@typescript-eslint/return-await": ["error", "always"],
  },
  parserOptions: {
    project: "./tsconfig.json",
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "packages/*/tsconfig.json",
      },
    },
  },
};
