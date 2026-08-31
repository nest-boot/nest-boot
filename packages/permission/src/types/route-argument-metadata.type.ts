import type { RouteArgumentMetadataValue } from "../interfaces/route-argument-metadata-value.interface.js";

/** Nest route arguments metadata map keyed by route parameter metadata token. */
export type RouteArgumentMetadata = Record<string, RouteArgumentMetadataValue>;
