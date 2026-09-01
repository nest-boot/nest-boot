import { Module } from "@nestjs/common";

import { StagedUploadResolver } from "./staged-upload.resolver.js";

/** GraphQL transport module for the globally registered staged upload service. */
@Module({ providers: [StagedUploadResolver] })
export class GraphQLStagedUploadModule {}
