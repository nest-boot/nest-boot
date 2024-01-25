import { generateCstDts } from "chevrotain";
import { writeFileSync } from "fs";
import { resolve } from "path";

import { searchSyntaxParser } from "../search-syntax.parser";

writeFileSync(
  resolve(__dirname, "./cst.d.ts"),
  `/* eslint-disable */\n${generateCstDts(searchSyntaxParser.getGAstProductions())}`,
);
