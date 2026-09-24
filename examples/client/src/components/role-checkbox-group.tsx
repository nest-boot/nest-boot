import { CheckboxGroup } from "@/components/thread-ui/checkbox-group";
import { getRoleLabel } from "@/utils/get-role-label";

interface RoleCheckboxGroupProps<Role extends string> {
  options: ReadonlyArray<{ role: Role; grantable: boolean }>;
  value: Array<Role>;
  onValueChange: (value: Array<Role>) => void;
  label: string;
  disabled?: boolean;
}

/** Existing roles can be removed, but unavailable grants cannot be added. */
export function RoleCheckboxGroup<Role extends string>({
  options,
  value,
  ...props
}: RoleCheckboxGroupProps<Role>) {
  return (
    <CheckboxGroup
      {...props}
      value={value}
      items={options.map(({ role, grantable }) => ({
        label: getRoleLabel(role),
        value: role,
        disabled: !grantable && !value.includes(role),
      }))}
    />
  );
}
