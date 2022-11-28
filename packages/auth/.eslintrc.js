module.exports = {
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
