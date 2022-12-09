import { Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./crypt.module-definition";
import { CryptService } from "./crypt.service";

@Module({ providers: [CryptService], exports: [CryptService] })
export class CryptModule extends ConfigurableModuleClass {}
