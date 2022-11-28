module.exports = {
  root: true,
  extends: ["nest-boot"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
  ],
};
