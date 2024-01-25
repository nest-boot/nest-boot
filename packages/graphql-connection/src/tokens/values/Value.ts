import { createToken, Lexer } from "chevrotain";

export const Value = createToken({
  name: "Value",
  pattern: Lexer.NA,
});
