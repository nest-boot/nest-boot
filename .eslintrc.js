module.exports = {
  root: true,
  extends: ["@nest-boot/eslint-config"],
  overrides: [
    {
      files: ["*.ts"],
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
  ],
  parserOptions: {
    project: ["tsconfig.json"],
  },
};
