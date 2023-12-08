import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./graphql.module-definition";
import { GraphQLModuleOptions } from "./interfaces";

@Injectable()
export class GraphiQLMiddleware implements NestMiddleware {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: GraphQLModuleOptions,
  ) {}

  use(req: Request, res: Response) {
    res.send(/* html */ `
<!doctype html>
<html lang="en">
  <head>
    <title>GraphiQL</title>
    <style>
      body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }

      #graphiql {
        height: 100vh;
      }
    </style>
    <!--
      This GraphiQL example depends on Promise and fetch, which are available in
      modern browsers, but can be "polyfilled" for older browsers.
      GraphiQL itself depends on React DOM.
      If you do not want to rely on a CDN, you can host these files locally or
      include them directly in your favored resource bundler.
    -->
    <script
      crossorigin
      src="https://unpkg.com/react@18/umd/react.development.js"
    ></script>
    <script
      crossorigin
      src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"
    ></script>
    <!--
      These two files can be found in the npm module, however you may wish to
      copy them directly into your environment, or perhaps include them in your
      favored resource bundler.
     -->
    <script
      src="https://unpkg.com/graphiql/graphiql.min.js"
      type="application/javascript"
    ></script>
    <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
    <!-- 
      These are imports for the GraphIQL Explorer plugin.
     -->
    <script
      src="https://unpkg.com/@graphiql/plugin-explorer/dist/index.umd.js"
      crossorigin
    ></script>

    <link
      rel="stylesheet"
      href="https://unpkg.com/@graphiql/plugin-explorer/dist/style.css"
    />

    <script
      src="https://unpkg.com/graphql-ws/umd/graphql-ws.min.js"
      crossorigin
    ></script>
  </head>

  <body>
    <div id="graphiql">Loading...</div>
    <script>
      const fetcher = GraphiQL.createFetcher({
        url: "${this.options.path ?? "/graphql"}",
        headers: {},
        ${
          typeof this.options.subscriptions !== "undefined"
            ? `wsClient: graphqlWs.createClient({
          url: (() => {
            const url = new URL(window.location.href);
            url.protocol = url.protocol.replace("http", "ws");
            url.pathname = "${this.options.subscriptions.path ?? "/graphql"}";
            return url.href;
          })(),
          lazy: false,
        }),`
            : ``
        }
      });

      
      

      

      const root = ReactDOM.createRoot(document.getElementById('graphiql'));
      const explorerPlugin = GraphiQLPluginExplorer.explorerPlugin();
      root.render(
        React.createElement(GraphiQL, {
          fetcher,
          defaultEditorToolsVisibility: true,
          plugins: [explorerPlugin],
        }),
      );
    </script>
  </body>
</html>`);
  }
}
