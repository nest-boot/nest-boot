import "reflect-metadata";

import { BaseCommand, Option } from "./index.js";

it("infers positional, optional, boolean and array types without manual interfaces", () => {
  class TypedCommand extends BaseCommand {
    name = Option.String({ required: true });
    schema = Option.String("--schema");
    enabled = Option.Boolean("--enabled", false);
    tags = Option.Array("--tag", []);
    async execute() {
      await Promise.resolve();
    }
  }
  const command = new TypedCommand();
  expectTypeOf(command.name).toEqualTypeOf<string>();
  expectTypeOf(command.schema).toEqualTypeOf<string | undefined>();
  expectTypeOf(command.enabled).toEqualTypeOf<boolean>();
  expectTypeOf(command.tags).toEqualTypeOf<string[]>();
});
