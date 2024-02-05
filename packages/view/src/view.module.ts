import { Inject, Module, type OnModuleInit, Optional } from "@nestjs/common";
import glob from "fast-glob";
import fs from "fs/promises";
import { basename, dirname, extname, join, relative } from "path";

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./view.module-definition";
import { ViewService } from "./view.service";
import { ViewModuleOptions } from "./view-module-options.interface";

@Module({ providers: [ViewService], exports: [ViewService] })
export class ViewModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(
    private readonly viewService: ViewService,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: ViewModuleOptions,
  ) {
    super();
  }

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
