import { createToken } from "chevrotain";

import { Value } from "./Value";

export const QuotedString = createToken({
  name: "QuotedString",
  pattern: /".*?"|'.*?'/,
  categories: [Value],
});
