import { MastraModule } from "../mastra.module.js";

/**
 * Compile-time server configuration restrictions for `MastraModuleOptions`.
 */
export function verifyMastraModuleOptionsTypes(): void {
  // @ts-expect-error Standalone Hono port belongs to NestJS.
  MastraModule.forRoot({ server: { port: 4111 } });
  const invalidServerOptions = { server: { port: 4111 } };
  // @ts-expect-error Variables must not bypass the server configuration boundary.
  MastraModule.forRoot(invalidServerOptions);
  const asyncOptions = {
    useFactory: () => Promise.resolve(invalidServerOptions),
  };
  // @ts-expect-error Async factories must not return standalone server configuration.
  MastraModule.forRootAsync(asyncOptions);
  // @ts-expect-error NestJS guards own authentication.
  MastraModule.forRoot({ server: { auth: { enabled: true } } });
  // @ts-expect-error Custom routes belong to NestJS controllers.
  MastraModule.forRoot({ server: { customRouteAuthConfig: new Map() } });
}
