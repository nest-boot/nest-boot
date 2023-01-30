import fs from "fs";

fs.copyFileSync("package.json", "package_bk.json");

const pack = JSON.parse(fs.readFileSync("package.json", "utf8"));

pack.dependencies = {};
pack.devDependencies = {};
pack.peerDependencies = {};

fs.writeFileSync("package.json", JSON.stringify(pack, null, 2));
