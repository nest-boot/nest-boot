import { createRequire } from 'node:module';

const rootRequire = createRequire(import.meta.url);
const graphqlPackageJson = rootRequire.resolve('@nestjs/graphql/package.json');

globalThis.require ??= createRequire(graphqlPackageJson);
