import { MODULE_METADATA } from "@nestjs/common/constants";

import { QueueModule } from "./queue.module.js";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "./queue.module-definition.js";

it("supports root options and async root options", () => {
  const options = { prefix: "test" };
  const useFactory = () => options;
  expect(QueueModule.forRoot(options).providers).toContainEqual({
    provide: BASE_MODULE_OPTIONS_TOKEN,
    useValue: options,
  });
  expect(QueueModule.forRootAsync({ useFactory }).providers).toContainEqual({
    provide: BASE_MODULE_OPTIONS_TOKEN,
    useFactory,
    inject: [],
  });
  const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, QueueModule);
  const fallback = providers.find(
    (p: any) => p.provide === MODULE_OPTIONS_TOKEN,
  );
  expect(fallback.useFactory()).toEqual({});
  expect(fallback.useFactory(options)).toBe(options);
});
