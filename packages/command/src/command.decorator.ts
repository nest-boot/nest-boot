import { SetMetadata } from "@nestjs/common";
import { Options, PositionalOptions } from "yargs";

import { COMMAND_ARGS_METADATA, COMMAND_HANDLER_METADATA } from "./constants";

export enum CommandParamTypes {
  POSITIONAL = "POSITIONAL",
  OPTION = "OPTION",
  ARGV = "ARGV",
}

export type CommandParamMetadata<O> = {
  [type in CommandParamTypes]: CommandParamMetadataItem<O>[];
};

export interface CommandParamMetadataItem<O> {
  index: number;
  option: O;
}

const createCommandParamDecorator = <O>(paramType: CommandParamTypes) => {
  return (option?: O): ParameterDecorator =>
    (target, key, index) => {
      const params =
        Reflect.getMetadata(COMMAND_ARGS_METADATA, target[key]) || {};
      Reflect.defineMetadata(
        COMMAND_ARGS_METADATA,
        {
          ...params,
          [paramType]: [...(params[paramType] || []), { index, option }],
        },
        target[key]
      );
    };
};

export interface CommandMetadata {
  params: CommandParamMetadata<CommandPositionalOption | CommandOptionsOption>;
  option: CommandOption;
}

export interface CommandOption {
  aliases?: string[] | string;
  command: string[] | string;
  describe?: string | false;
  autoExit?: boolean;
}

export function Command(option: CommandOption): MethodDecorator {
  return (
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: object,
    key: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    if (option && typeof option.autoExit !== "boolean") {
      // eslint-disable-next-line no-param-reassign
      option.autoExit = true;
    }

    const metadata: CommandMetadata = {
      params: Reflect.getMetadata(COMMAND_ARGS_METADATA, descriptor.value),
      option,
    };

    SetMetadata(COMMAND_HANDLER_METADATA, metadata)(target, key, descriptor);
  };
}

export interface CommandPositionalOption extends PositionalOptions {
  name: string;
}

export const Positional = createCommandParamDecorator<CommandPositionalOption>(
  CommandParamTypes.POSITIONAL
);

export interface CommandOptionsOption extends Options {
  name: string;
}

export const Option = createCommandParamDecorator<CommandOptionsOption>(
  CommandParamTypes.OPTION
);

export const Argv = createCommandParamDecorator(CommandParamTypes.ARGV);
