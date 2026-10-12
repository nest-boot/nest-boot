import { Inject, Injectable, Scope } from "@nestjs/common";
import { DiscoveryService, Reflector } from "@nestjs/core";
import type { Cli } from "clipanion";

import { BaseCommand } from "./base.command.js";
import { ClipanionCommand } from "./clipanion.js";
import { COMMAND_OPTIONS } from "./command.constants.js";
import type { CommandOptions } from "./command-options.interface.js";

/** Discovers command providers across imported Nest modules. */
@Injectable()
export class CommandRegistry {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  /**
   * Registers command adapters while retaining the actual Nest provider instances.
   * @param cli - Parser receiving all commands in this application context.
   */
  register(cli: Cli): void {
    const paths = new Set<string>();
    const instances = new Set<BaseCommand>();
    for (const wrapper of this.discovery.getProviders()) {
      if (!wrapper.metatype) continue;
      const options = this.reflector.get<CommandOptions | undefined>(
        COMMAND_OPTIONS,
        wrapper.metatype,
      );
      if (!options) continue;
      if (
        wrapper.scope === Scope.TRANSIENT ||
        !wrapper.isDependencyTreeStatic()
      ) {
        throw new Error(
          `Command ${String(wrapper.name)} must use singleton dependencies.`,
        );
      }
      const instance: unknown = wrapper.instance;
      if (!(instance instanceof BaseCommand)) {
        throw new Error(
          `Command ${String(wrapper.name)} must extend BaseCommand.`,
        );
      }
      if (instances.has(instance)) continue;
      instances.add(instance);
      if (!options.paths.length) {
        throw new Error(
          `Command ${String(wrapper.name)} must declare at least one path.`,
        );
      }
      for (const path of options.paths) {
        if (
          !path.length ||
          path.some((segment) => !segment || /\s/.test(segment))
        ) {
          throw new Error(
            `Command ${String(wrapper.name)} has an invalid path.`,
          );
        }
        const key = JSON.stringify(path);
        if (paths.has(key)) {
          throw new Error(`Duplicate command path: ${path.join(" ")}`);
        }
        paths.add(key);
      }
      cli.register(this.createAdapter(instance, options));
    }
  }

  /**
   * Bridges Clipanion's no-argument constructor to a Nest-owned provider.
   * @param instance - Initialized command with its injected dependencies.
   * @param options - Command paths and help text.
   * @returns The class used only for argument parsing.
   */
  private createAdapter(instance: BaseCommand, options: CommandOptions) {
    const definitions = Object.fromEntries(
      Object.entries(instance).filter(
        ([, value]) =>
          typeof value === "object" &&
          value !== null &&
          Reflect.get(value, ClipanionCommand.isOption) === true,
      ),
    );
    const commandClass = instance.constructor as typeof BaseCommand;
    return class CommandAdapter extends ClipanionCommand {
      static paths = options.paths;
      static usage = options.usage ?? {};
      static schema = commandClass.schema;
      private executionStarted = false;

      constructor() {
        super();
        Object.assign(this, definitions);
      }

      /**
       * Copies parser state before invoking either execution or error handling.
       */
      private syncState(): void {
        for (const key of Object.keys(definitions)) {
          Reflect.set(instance, key, Reflect.get(this, key));
        }
        instance.context = this.context;
        instance.cli = this.cli;
        instance.path = this.path;
        instance.help = this.help;
      }

      /**
       * Runs the Nest provider with its parsed options and CLI context.
       * @returns The optional command exit code.
       */
      async execute(): Promise<number | undefined> {
        this.syncState();
        this.executionStarted = true;
        return (await instance.execute()) ?? undefined;
      }

      /**
       * Preserves custom command error handling on the Nest instance.
       * @param error - Failure raised while executing the command.
       */
      async catch(error: Error): Promise<void> {
        // Schema failures precede execute(); execution failures already have
        // initialized state, including any changes made by the Nest command.
        if (!this.executionStarted) this.syncState();
        await instance.catch(error);
      }
    };
  }
}
