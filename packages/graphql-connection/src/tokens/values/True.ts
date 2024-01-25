import { createToken } from "chevrotain";

import { Identifier } from "../Identifier";
import { Value } from "./Value";

export const True = createToken({
  name: "True",
  pattern: /true/,
  longer_alt: Identifier,
  categories: [Value],
});
