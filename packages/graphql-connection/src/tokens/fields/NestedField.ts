import { createToken } from "chevrotain";

import { UnquotedLiteral } from "../UnquotedLiteral";
import { Field } from "./Field";

export const NestedField = createToken({
  name: "NestedField",
  pattern: /[a-zA-Z]\w*(\.[a-zA-Z]\w*)+/,
  longer_alt: UnquotedLiteral,
  categories: [Field],
});
