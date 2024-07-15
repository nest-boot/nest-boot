const fs = require("fs");
const path = require("path");

// 定义要遍历的目录
const baseDir = path.join(__dirname, "examples");

// 读取目录内容
fs.readdir(baseDir, (err, files) => {
  if (err) {
    console.error(`读取目录时出错: ${err.message}`);
    return;
  }

  // 遍历每个子目录
  files.forEach((file) => {
    const subDir = path.join(baseDir, file);

    // 检查子目录中是否存在 .eslintrc.js 文件
    const oldFilePath = path.join(subDir, "eslint.config.js");
    const newFilePath = path.join(subDir, ".eslintrc.js");

    fs.access(oldFilePath, fs.constants.F_OK, (err) => {
      if (!err) {
        // 重命名文件
        fs.rename(oldFilePath, newFilePath, (err) => {
          if (err) {
            console.error(`重命名文件时出错: ${err.message}`);
          } else {
            console.log(`已重命名: ${oldFilePath} -> ${newFilePath}`);
          }
        });
      }
    });
  });
});
