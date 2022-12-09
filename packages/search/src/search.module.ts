import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { ConfigurableModuleClass } from "./search.module-definition";
import { SearchService } from "./search.service";

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule extends ConfigurableModuleClass {}
