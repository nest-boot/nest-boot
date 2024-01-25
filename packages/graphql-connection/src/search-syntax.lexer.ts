import { Lexer } from "chevrotain";

import { tokens } from "./tokens";

export class SearchSyntaxLexer extends Lexer {
  constructor() {
    super(tokens);
  }
}

export const searchSyntaxLexer = new SearchSyntaxLexer();
