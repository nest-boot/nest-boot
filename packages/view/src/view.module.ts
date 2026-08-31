import { type DynamicModule, Module, type Provider } from "@nestjs/common";
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
 * Template rendering module powered by LiquidJS.
 *
 * @remarks
 * Provides a configured `Liquid` instance. Import the module directly
 * to use the default `views/` paths, or use {@link ViewModule.register} and
 * {@link ViewModule.registerAsync} to pass any LiquidJS options.
 */
@Module({ providers: [liquidProvider], exports: [liquidProvider] })
export class ViewModule extends ConfigurableModuleClass {
  /**
   * Registers the ViewModule with the given options.
   * @param options - LiquidJS configuration options
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
}
