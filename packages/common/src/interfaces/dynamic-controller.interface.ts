import type { Provider, Type } from "@nestjs/common";

/** Paired isolated controller subclass and its configuration provider. */
export interface DynamicController<TController = unknown> {
  /** Isolated subclass of the base controller for a single module registration. */
  controller: Type<TController>;

  /** Factory provider that applies dynamic route and decorator metadata before route discovery. */
  provider: Provider;
}
