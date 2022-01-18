import { Injectable } from "@nestjs/common";
import { Injectable as InjectableInterface } from "@nestjs/common/interfaces";
import { MetadataScanner, ModulesContainer } from "@nestjs/core";
import { compact, flattenDeep } from "lodash";
import { Argv, CommandModule } from "yargs";

import {
  CommandMetadata,
  CommandOptionsOption,
  CommandParamMetadata,
  CommandParamMetadataItem,
  CommandParamTypes,
  CommandPositionalOption,
} from "./command.decorator";
import { CommandService } from "./command.service";
import { COMMAND_HANDLER_METADATA } from "./constants";

@Injectable()
export class CommandExplorerService {
  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner,
    private readonly commandService: CommandService
  ) {}

  explore(): CommandModule[] {
    const components = [...this.modulesContainer.values()].map(
      (module) => module.components
    );

    return compact(
      flattenDeep<CommandModule>(
        components.map((component) =>
          [...component.values()].map(({ instance }) =>
            this.filterCommands(instance)
          )
        )
      )
    );
  }

  protected filterCommands(instance: InjectableInterface): CommandModule[] {
    if (!instance) {
      return null;
    }

    const prototype = Object.getPrototypeOf(instance);
    const components = this.metadataScanner.scanFromPrototype(
      instance,
      prototype,
      (name) => this.extractMetadata(instance, prototype, name)
    );

    return components
      .filter((command) => !!command.metadata)
      .map<CommandModule>((command) => {
        const exec = instance[command.methodName].bind(instance);
        const builder = (yargs: Argv) => {
          return this.generateCommandBuilder(command.metadata.params, yargs);
        }; // EOF builder

        const handler = async (argv: unknown) => {
          const params = this.generateCommandHandlerParams(
            command.metadata.params,
            argv
          );

          this.commandService.run();
          const code = await exec(...params);

          if (command.metadata.option.autoExit) {
            this.commandService.exit(code || 0);
          }
        };

        return {
          ...command.metadata.option,
          builder,
          handler,
        };
      });
  }

  protected extractMetadata(
    instance: InjectableInterface,
    prototype: unknown,
    methodName: string
  ): { methodName: string; metadata: CommandMetadata } {
    const callback = prototype[methodName];
    const metadata: CommandMetadata = Reflect.getMetadata(
      COMMAND_HANDLER_METADATA,
      callback
    );

    return {
      methodName,
      metadata,
    };
  }

  protected iteratorParamMetadata<O>(
    params: CommandParamMetadata<O>,
    callback: (item: CommandParamMetadataItem<O>, key: string) => void
  ): void {
    if (!params) {
      return;
    }

    Object.keys(params).forEach((key) => {
      const param: CommandParamMetadataItem<O>[] = params[key];
      if (!param || !Array.isArray(param)) {
        return;
      }

      param.forEach((metadata) => callback(metadata, key));
    });
  }

  private generateCommandHandlerParams(
    params: CommandParamMetadata<
      CommandOptionsOption | CommandPositionalOption
    >,
    argv: unknown
  ) {
    const list = [];

    this.iteratorParamMetadata(params, (item, key) => {
      switch (key) {
        case CommandParamTypes.OPTION:
          list[item.index] = argv[(item.option as CommandOptionsOption).name];
          break;

        case CommandParamTypes.POSITIONAL:
          list[item.index] =
            argv[(item.option as CommandPositionalOption).name];
          break;

        case CommandParamTypes.ARGV:
          list[item.index] = argv;
          break;
        default:
      }
    });

    return list;
  }

  private generateCommandBuilder(
    params: CommandParamMetadata<
      CommandOptionsOption | CommandPositionalOption
    >,
    yargs: Argv
  ) {
    this.iteratorParamMetadata(params, (item, key) => {
      switch (key) {
        case CommandParamTypes.OPTION:
          yargs.option(
            (item.option as CommandOptionsOption).name,
            item.option as CommandOptionsOption
          );
          break;

        case CommandParamTypes.POSITIONAL:
          yargs.positional(
            (item.option as CommandPositionalOption).name,
            item.option as CommandPositionalOption
          );
          break;

        default:
          break;
      }
    });

    return yargs;
  }
}
