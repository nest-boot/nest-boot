import { applyDecorators, Injectable, SetMetadata } from "@nestjs/common";

import { COMMAND_OPTIONS } from "../command.constants.js";
import type { CommandOptions } from "../command-options.interface.js";

/**
 * Declares an injectable command; register its class in a module's providers.
 * @param options - Command paths and help text.
 * @returns The command class decorator.
 */
export function Command(options: CommandOptions): ClassDecorator {
  return applyDecorators(Injectable(), SetMetadata(COMMAND_OPTIONS, options));
}
