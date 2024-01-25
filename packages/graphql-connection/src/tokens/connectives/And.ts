import { createToken } from "chevrotain";

import { Identifier } from "../Identifier";

export const And = createToken({
  name: "And",
  pattern: /and|AND/,
  longer_alt: Identifier,
});
