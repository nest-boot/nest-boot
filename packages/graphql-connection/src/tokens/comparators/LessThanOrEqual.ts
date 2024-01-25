import { createToken } from "chevrotain";

import { Comparator } from "./Comparator";

export const LessThanOrEqual = createToken({
  name: "LessThanOrEqual",
  pattern: /:<=/,
  categories: [Comparator],
});
