import { Migration } from '@mikro-orm/migrations';

/** 将现有策略的工作区变量切换到原生 session 使用的 app.workspace。 */
export class Migration20260909000000_NativeRls extends Migration {
  override up(): void {
    this.addSql(
      `alter policy workspace_update_policy on "public"."workspace" using (id = nullif(current_setting('app.workspace', true), '')::bigint) with check (id = nullif(current_setting('app.workspace', true), '')::bigint);`,
    );
    this.addSql(
      `alter policy workspace_member_workspace_all_authenticated_policy on "public"."workspace_member" using (workspace_id = nullif(current_setting('app.workspace', true), '')::bigint) with check (workspace_id = nullif(current_setting('app.workspace', true), '')::bigint);`,
    );
    this.addSql(
      `alter policy user_update_policy on "public"."user" using (id = nullif(current_setting('app.user_id', true), '')::bigint) with check (id = nullif(current_setting('app.user_id', true), '')::bigint);`,
    );
    this.addSql(
      `alter policy workspace_member_user_all_authenticated_policy on "public"."workspace_member" using (user_id = nullif(current_setting('app.user_id', true), '')::bigint) with check (user_id = nullif(current_setting('app.user_id', true), '')::bigint);`,
    );
  }

  override down(): void {
    this.addSql(
      `alter policy user_update_policy on "public"."user" using ((select nullif(current_setting('app.user_id', true), '')::bigint) = id) with check ((select nullif(current_setting('app.user_id', true), '')::bigint) = id);`,
    );
    this.addSql(
      `alter policy workspace_member_user_all_authenticated_policy on "public"."workspace_member" using ((select nullif(current_setting('app.user_id', true), '')::bigint) = user_id) with check ((select nullif(current_setting('app.user_id', true), '')::bigint) = user_id);`,
    );
    this.addSql(
      `alter policy workspace_update_policy on "public"."workspace" using ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = id) with check ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = id);`,
    );
    this.addSql(
      `alter policy workspace_member_workspace_all_authenticated_policy on "public"."workspace_member" using ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = workspace_id) with check ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = workspace_id);`,
    );
  }
}
