import { createToken } from "chevrotain";

import { Comparator } from "./Comparator";

export const GreaterThanOrEqual = createToken({
  name: "GreaterThanOrEqual",
  pattern: /:>=/,
  categories: [Comparator],
});
