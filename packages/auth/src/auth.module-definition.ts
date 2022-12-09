import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { AuthModuleOptions } from "./interfaces";

export const PERMISSIONS_METADATA_KEY = randomUUID();

export const REQUIRE_AUTH_METADATA_KEY = randomUUID();

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<AuthModuleOptions>().build();
