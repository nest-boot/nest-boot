import { createToken } from "chevrotain";

import { Field } from "./fields";
import { UnquotedLiteral } from "./UnquotedLiteral";
import { Value } from "./values";

export const Identifier = createToken({
  name: "Identifier",
  pattern: /[a-zA-Z]\w*/,
  longer_alt: UnquotedLiteral,
  categories: [Field, Value],
});
