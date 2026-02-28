import {
  type DynamicModule,
  Inject,
  Module,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";
import glob from "fast-glob";
import fs from "fs/promises";
import { basename, dirname, extname, join, relative } from "path";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./view.module-definition";
import { ViewService } from "./view.service";
import { ViewModuleOptions } from "./view-module-options.interface";

/**
 * Template rendering module using Handlebars.
 *
 * @remarks
 * Automatically discovers and registers Handlebars templates from
 * configured directories, providing them via the {@link ViewService}.
 */
@Module({ providers: [ViewService], exports: [ViewService] })
export class ViewModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  /**
   * Registers the ViewModule with the given options.
   * @param options - Configuration options including template paths
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the ViewModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }

  /**
   * Creates a new ViewModule instance.
   * @param viewService - Service for managing Handlebars templates
   * @param options - Optional module configuration with template paths
   */
  constructor(
    private readonly viewService: ViewService,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: ViewModuleOptions,
  ) {
    super();
  }

  /** Discovers and registers Handlebars templates from configured paths. */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      (this.options?.path ?? ["views"]).map(async (dir) => {
        const paths = await glob(join(dir, "/**/*.{hbs,handlebars}"), {
          onlyFiles: true,
        });

        await Promise.all(
          paths.map(async (path) => {
            const name = join(
              relative(dir, dirname(path)),
              basename(path, extname(path)),
            ).replace(/\/|\\/g, ".");

            const template = await fs.readFile(path, "utf-8");

            this.viewService.register(name, template);
          }),
        );
      }),
    );
  }
}
