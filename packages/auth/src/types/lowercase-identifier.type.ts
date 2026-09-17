type Letter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type ValidTail<
  Value extends string,
  Separator extends string,
> = Value extends ""
  ? true
  : Value extends `${Letter | Digit | Separator}${infer Rest}`
    ? ValidTail<Rest, Separator>
    : false;

/** @internal Validates an ASCII identifier without changing its value. */
export type LowercaseIdentifier<
  Value extends string,
  Separator extends string,
> = Value extends `${string}--${string}`
  ? never
  : Value extends `${Letter}${infer Rest}`
    ? ValidTail<Rest, Separator> extends true
      ? Value
      : never
    : never;
