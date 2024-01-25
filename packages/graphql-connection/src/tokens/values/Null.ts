import { createToken } from "chevrotain";

import { Identifier } from "../Identifier";
import { Value } from "./Value";

export const Null = createToken({
  name: "Null",
  pattern: /null/,
  longer_alt: Identifier,
  categories: [Value],
});
