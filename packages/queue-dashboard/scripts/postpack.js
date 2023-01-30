import fs from "fs";

if (fs.existsSync("package_bk.json")) {
  fs.copyFileSync("package_bk.json", "package.json");
  fs.unlinkSync("package_bk.json");
}
