import {
  Policy,
  PolicyCommand,
  PolicyMode,
} from '@nest-boot/row-level-security';

/**
 * 为带有 `deleted_at` 字段的实体添加通用软删除 RLS 策略。
 *
 * @returns 组合后的类装饰器。
 */
export function SoftDeletePolicy(): ClassDecorator {
  const decorators = [
    Policy({
      name: 'soft_delete_select_policy',
      mode: PolicyMode.RESTRICTIVE,
      command: PolicyCommand.SELECT,
      using: '"deleted_at" is null',
    }),
    Policy({
      name: 'soft_delete_update_policy',
      mode: PolicyMode.RESTRICTIVE,
      command: PolicyCommand.UPDATE,
      using: '"deleted_at" is null',
      withCheck: '(true)',
    }),
    Policy({
      name: 'soft_delete_delete_policy',
      mode: PolicyMode.RESTRICTIVE,
      command: PolicyCommand.DELETE,
      using: '(false)',
    }),
  ];

  return (target) => {
    for (const decorator of decorators) {
      decorator(target);
    }
  };
}
