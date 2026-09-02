import { useMemo } from "react";
import { t } from "i18next";

import type { WorkspacePermission } from "@/gql/graphql";
import { CheckboxGroup } from "@/components/thread-ui/checkbox-group";
import { workspacePermissions } from "@/lib/workspace-permissions";

export interface PermissionCheckboxGroupProps {
  value: Array<WorkspacePermission>;
  onChange: (value: Array<WorkspacePermission>) => void;
  disabled?: boolean;
}

export function PermissionCheckboxGroup({
  value,
  onChange,
  disabled = false,
}: PermissionCheckboxGroupProps) {
  const allPermissions = useMemo(
    () => Object.keys(workspacePermissions) as Array<WorkspacePermission>,
    [],
  );

  const items = useMemo(
    () =>
      allPermissions.map((permission) => ({
        value: permission,
        label: t(workspacePermissions[permission].name),
        description: t(workspacePermissions[permission].description),
      })),
    [allPermissions],
  );

  return (
    <CheckboxGroup
      label={t("workspace-member-group:detail.form.permissions_field.label")}
      value={value}
      onValueChange={(newValue) => onChange(newValue)}
      disabled={disabled}
      parent={{
        label: t("permission:all.name"),
        description: t("permission:all.description"),
      }}
      items={items}
    />
  );
}
