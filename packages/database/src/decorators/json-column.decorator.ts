import { omit } from "lodash";

import { Column, ColumnOptions } from "./column.decorator";

class Wrap<T> {
  constructor(private readonly value: T) {}

  toJSON(): T {
    return this.value;
  }
}

export function JSONColumn(
  options: Exclude<ColumnOptions, "type" | "transformer"> = {}
): ReturnType<typeof Column> {
  let { generator } = options;

  if (!generator && options.default !== undefined) {
    generator =
      options.default instanceof Function &&
      options.default.prototype === undefined
        ? options.default
        : () => options.default;
  }

  return Column({
    ...omit(options, ["nullable"]),
    generator,
    default: undefined,
    type: "json",
    transformer: {
      to: (value) => {
        if (
          options.nullable === true &&
          (value === null || value === undefined)
        ) {
          return new Wrap(null);
        }

        return value;
      },
      from: (value) => value,
    },
  });
}
