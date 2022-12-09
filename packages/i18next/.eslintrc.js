module.exports = {
  root: true,
  extends: ["nest-boot"],
  overrides: [
    {
      files: ["*.ts"],
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
  ],
};
