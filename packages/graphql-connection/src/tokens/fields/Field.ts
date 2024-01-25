import { createToken, Lexer } from "chevrotain";

export const Field = createToken({
  name: "Field",
  pattern: Lexer.NA,
});
