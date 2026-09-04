import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: `../server/schema.gql`,
  documents: ["./src/**/*.{ts,tsx,gql,graphql}"],
  generates: {
    "./src/gql/": {
      preset: "client",
      presetConfig: {
        /**
         * https://www.apollographql.com/docs/react/data/fragments#with-the-client-preset
         * https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-operations
         *  */
        fragmentMasking: false,
      },
      config: {
        customDirectives: {
          apolloUnmask: true,
        },
        namingConvention: {
          enumValues: "keep",
        },
        inlineFragmentTypes: "mask",
        scalars: {
          JSONObject: {
            input: "Record<string, unknown>",
            output: "Record<string, unknown>",
          },
        },
      },
    },
  },
  hooks: { afterAllFileWrite: ["prettier --write"] },
};

export default config;
