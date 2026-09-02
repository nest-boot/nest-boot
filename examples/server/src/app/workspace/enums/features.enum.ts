import { registerEnumType } from '@nest-boot/graphql';

/**
 * 工作区可启用的功能开关。
 */
export enum WorkspaceFeature {
  /** AI 相关能力。 */
  AI = 'AI',
}

registerEnumType(WorkspaceFeature, {
  name: 'WorkspaceFeature',
});
