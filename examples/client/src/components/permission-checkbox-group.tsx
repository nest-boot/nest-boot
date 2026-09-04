import { t } from "i18next";

import type { PermissionOption } from "@/lib/permissions";
import { CheckboxGroup } from "@/components/thread-ui/checkbox-group";

export interface PermissionCheckboxGroupProps<Permission extends string> {
  options: ReadonlyArray<PermissionOption<Permission>>;
  value: Array<Permission>;
  onChange: (value: Array<Permission>) => void;
  disabled?: boolean;
}

export function PermissionCheckboxGroup<Permission extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: PermissionCheckboxGroupProps<Permission>) {
  return (
    <CheckboxGroup
      label={t("permission:label")}
      value={value}
      onValueChange={(newValue) => onChange(newValue)}
      disabled={disabled}
      parent={{
        label: t("permission:all.name"),
        description: t("permission:all.description"),
      }}
      items={options.map((option) => ({
        value: option.value,
        label: t(option.name),
        description: t(option.description),
        testId: `permission-${option.value}`,
      }))}
    />
  );
}
