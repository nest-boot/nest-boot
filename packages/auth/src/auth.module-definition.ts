import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { type AuthModuleOptions } from "./interfaces";

export const PERMISSIONS_METADATA_KEY = randomUUID();

export const REQUIRE_AUTH_METADATA_KEY = randomUUID();

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<AuthModuleOptions>().build();

export const AUTH_USER = Symbol("AUTH_USER");

export const AUTH_PERSONAL_ACCESS_TOKEN = Symbol("AUTH_PERSONAL_ACCESS_TOKEN");
