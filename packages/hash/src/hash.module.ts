import { Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./hash.module-definition";
import { HashService } from "./hash.service";

@Module({ providers: [HashService], exports: [HashService] })
export class HashModule extends ConfigurableModuleClass {}
