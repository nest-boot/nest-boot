import { createToken } from "chevrotain";

import { Comparator } from "./Comparator";

export const LessThan = createToken({
  name: "LessThan",
  pattern: /:</,
  categories: [Comparator],
});
