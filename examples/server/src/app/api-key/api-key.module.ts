import { Module } from '@nestjs/common';

import { ApiKeyResolver } from './api-key.resolver.js';

/**
 * API Key 功能模块。
 */
@Module({
  providers: [ApiKeyResolver],
})
export class ApiKeyModule {}
