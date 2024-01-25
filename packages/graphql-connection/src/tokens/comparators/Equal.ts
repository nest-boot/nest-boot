import { createToken } from "chevrotain";

import { Comparator } from "./Comparator";

export const Equal = createToken({
  name: "Equal",
  pattern: /:/,
  categories: [Comparator],
});
