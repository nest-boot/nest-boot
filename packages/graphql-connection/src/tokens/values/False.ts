import { createToken } from "chevrotain";

import { Identifier } from "../Identifier";
import { Value } from "./Value";

export const False = createToken({
  name: "False",
  pattern: /false/,
  longer_alt: Identifier,
  categories: [Value],
});
