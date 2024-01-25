import { createToken } from "chevrotain";

export const Wildcard = createToken({
  name: "Wildcard",
  pattern: /\*/,
});
