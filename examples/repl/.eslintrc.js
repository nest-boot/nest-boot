module.exports = {
  extends: ['@nest-boot/eslint-config'],
  overrides: [
    {
      files: ['*.ts'],
      parserOptions: {
        project: ['tsconfig.json'],
      },
    },
  ],
};
