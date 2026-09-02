import { registerEnumType } from '@nest-boot/graphql';

/**
 * 工作区成员类型。
 */
export enum WorkspaceMemberType {
  /** 真实用户成员。 */
  USER = 'USER',
  /** 服务账号成员。 */
  SERVICE_ACCOUNT = 'SERVICE_ACCOUNT',
}

registerEnumType(WorkspaceMemberType, {
  name: 'WorkspaceMemberType',
});
