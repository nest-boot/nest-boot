import { Module } from '@nestjs/common';

import { WorkspaceResolver } from './workspace.resolver.js';

/**
 * 工作区功能模块。
 */
@Module({
  providers: [WorkspaceResolver],
})
export class WorkspaceModule {}
