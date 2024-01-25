import { generateCstDts } from "chevrotain";
import { writeFileSync } from "fs";
import { resolve } from "path";

import { SearchSyntaxParser } from "./search-syntax.parser";

const parser = new SearchSyntaxParser();

writeFileSync(
  resolve(__dirname, "./cst.d.ts"),
  generateCstDts(parser.getGAstProductions()),
);
