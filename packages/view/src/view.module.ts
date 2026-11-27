import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";
import { Liquid } from "liquidjs";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./view.module-definition.js";
import { type ViewModuleOptions } from "./view-module-options.interface.js";

const liquidProvider: Provider<Liquid> = {
  provide: Liquid,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options: ViewModuleOptions = {}) =>
    new Liquid({
      ...options,
      outputEscape: options.outputEscape ?? "escape",
      root: options.root ?? ["views/"],
      partials: options.partials ?? ["views/partials/"],
      layouts: options.layouts ?? ["views/layouts/"],
      extname: options.extname ?? ".liquid",
    }),
};

/**
 * Global template rendering module powered by LiquidJS.
 *
 * Provides a configured `Liquid` instance. Import the module directly
 * to use the default `views/` paths, or use {@link ViewModule.forRoot} and
 * {@link ViewModule.forRootAsync} to pass any LiquidJS options.
 */
@Global()
@Module({ providers: [liquidProvider], exports: [liquidProvider] })
export class ViewModule extends ConfigurableModuleClass {
  /**
   * Registers the ViewModule with the given options.
   * @param options - LiquidJS configuration options
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the ViewModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
