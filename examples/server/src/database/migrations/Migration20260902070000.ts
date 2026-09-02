import { Migration } from '@mikro-orm/migrations';

/** Stores workspace member permissions as resource-action JSON records. */
export class Migration20260902070000 extends Migration {
  /** Converts the legacy permission enum array to a JSON object. */
  override async up(): Promise<void> {
    this.addSql(
      `alter table "workspace_member" alter column "permissions" drop default;`,
    );
    this.addSql(
      `alter table "workspace_member" alter column "permissions" type jsonb using ((case when 'MANAGE_WORKSPACE' = any("permissions") then '{"workspace":["manage"]}'::jsonb else '{}'::jsonb end) || (case when 'MANAGE_MEMBERS' = any("permissions") then '{"workspaceMember":["manage"]}'::jsonb else '{}'::jsonb end));`,
    );
    this.addSql(
      `alter table "workspace_member" alter column "permissions" set default '{}'::jsonb;`,
    );
  }

  /** Converts supported JSON permissions back to the legacy enum array. */
  override async down(): Promise<void> {
    this.addSql(
      `alter table "workspace_member" alter column "permissions" drop default;`,
    );
    this.addSql(
      `alter table "workspace_member" alter column "permissions" type text[] using array_remove(array[case when ("permissions" -> 'workspace') ? 'manage' then 'MANAGE_WORKSPACE'::text else null end, case when ("permissions" -> 'workspaceMember') ? 'manage' then 'MANAGE_MEMBERS'::text else null end], null);`,
    );
    this.addSql(
      `alter table "workspace_member" alter column "permissions" set default '{}';`,
    );
  }
}
