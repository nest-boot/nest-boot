import { Inject, Injectable } from "@nestjs/common";
import {
  SearchEngineInterface,
  SearchModuleOptions,
  SearchOptions,
} from "./interfaces";
import { MODULE_OPTIONS_TOKEN } from "./search.module-definition";

@Injectable()
export class SearchService implements SearchEngineInterface {
  private readonly engine: SearchEngineInterface;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) readonly options: SearchModuleOptions
  ) {
    this.engine = options.engine;
  }

  search(
    index: string,
    query: string,
    options?: SearchOptions<any>
  ): Promise<[(string | number)[], number]> {
    return this.engine.search(index, query, options);
  }
}
