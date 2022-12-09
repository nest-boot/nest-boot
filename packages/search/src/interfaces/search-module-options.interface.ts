import { SearchEngineInterface } from "./search-engine.interface";

export interface SearchModuleOptions {
  isGlobal?: boolean;
  engine: SearchEngineInterface;
}
