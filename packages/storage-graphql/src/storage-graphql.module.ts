import { Module } from "@nestjs/common";

import { TemporaryFileUploadResolver } from "./temporary-file-upload.resolver.js";

/** GraphQL transport module for the globally registered {@link StorageService}. */
@Module({ providers: [TemporaryFileUploadResolver] })
export class StorageGraphQLModule {}
