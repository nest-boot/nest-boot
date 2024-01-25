import { createToken } from "chevrotain";

import { Date } from "./Date";
import { Value } from "./Value";

export const Number = createToken({
  name: "Number",
  pattern: /[+-]?([0-9]*[.])?[0-9]+/,
  longer_alt: Date,
  categories: [Value],
});
