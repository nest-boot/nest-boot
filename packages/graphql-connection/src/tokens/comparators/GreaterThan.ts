import { createToken } from "chevrotain";

import { Comparator } from "./Comparator";

export const GreaterThan = createToken({
  name: "GreaterThan",
  pattern: /:>/,
  categories: [Comparator],
});
