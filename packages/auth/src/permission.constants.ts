/** Reflection metadata key used by the `Can` decorator. */
export const CAN_METADATA = Symbol("CAN_METADATA");

/** Request context key that stores the resolved permission ability. */
export const PERMISSION_ABILITY = Symbol("PERMISSION_ABILITY");

/** Request context key that stores the in-flight permission ability promise. */
export const PERMISSION_ABILITY_PROMISE = Symbol("PERMISSION_ABILITY_PROMISE");

/** Nest route arguments metadata key. */
export const ROUTE_ARGS_METADATA = "__routeArguments__";

/** Nest custom route arguments metadata key suffix. */
export const CUSTOM_ROUTE_ARGS_METADATA = "__customRouteArgs__";

/** GraphQL route parameter type ids used by Nest GraphQL. */
export const GQL_PARAM_TYPES = {
  /** GraphQL root object parameter type id. */
  ROOT: 0,
  /** GraphQL context parameter type id. */
  CONTEXT: 1,
  /** GraphQL resolve info parameter type id. */
  INFO: 2,
  /** GraphQL arguments parameter type id. */
  ARGS: 3,
} as const;

/** HTTP route parameter type ids used by Nest. */
export const ROUTE_PARAM_TYPES = {
  /** HTTP request parameter type id. */
  REQUEST: 0,
  /** HTTP response parameter type id. */
  RESPONSE: 1,
  /** HTTP next callback parameter type id. */
  NEXT: 2,
  /** HTTP body parameter type id. */
  BODY: 3,
  /** HTTP query parameter type id. */
  QUERY: 4,
  /** HTTP route params parameter type id. */
  PARAM: 5,
  /** HTTP headers parameter type id. */
  HEADERS: 6,
  /** HTTP session parameter type id. */
  SESSION: 7,
  /** HTTP uploaded file parameter type id. */
  FILE: 8,
  /** HTTP uploaded files parameter type id. */
  FILES: 9,
  /** HTTP host parameter type id. */
  HOST: 10,
  /** HTTP IP parameter type id. */
  IP: 11,
  /** HTTP raw body parameter type id. */
  RAW_BODY: 12,
} as const;
