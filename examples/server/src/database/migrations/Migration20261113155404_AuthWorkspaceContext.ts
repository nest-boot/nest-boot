import { Migration } from '@mikro-orm/migrations';

export class Migration20261113155404_AuthWorkspaceContext extends Migration {
  override name = 'Migration20261113155404_AuthWorkspaceContext';

  override up(): void | Promise<void> {
    this.addSql(`drop policy "api_key_all_policy" on "api_key";`);

    this.addSql(`drop policy "account_select_policy" on "account";`);

    this.addSql(`drop policy "workspace_delete_policy" on "workspace";`);
    this.addSql(`drop policy "workspace_update_policy" on "workspace";`);

    this.addSql(
      `drop policy "workspace_invitation_all_policy" on "workspace_invitation";`,
    );
    this.addSql(
      `drop policy "workspace_invitation_recipient_select_policy" on "workspace_invitation";`,
    );

    this.addSql(
      `drop policy "workspace_member_all_policy" on "workspace_member";`,
    );
    this.addSql(
      `drop policy "workspace_member_select_policy" on "workspace_member";`,
    );

    this.addSql(
      `create policy "api_key_all_policy" on "api_key" to "authenticated" using ((("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.auth.user.id', true), '')::bigint) OR ("owner_type" = 'workspace_member' AND nullif(current_setting('app.auth.workspace_member.id', true), '') IS NOT NULL AND EXISTS (SELECT 1 FROM "workspace_member" WHERE "workspace_member"."id" = "owner_id" AND "workspace_member"."workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint)))) with check ((("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.auth.user.id', true), '')::bigint) OR ("owner_type" = 'workspace_member' AND nullif(current_setting('app.auth.workspace_member.id', true), '') IS NOT NULL AND EXISTS (SELECT 1 FROM "workspace_member" WHERE "workspace_member"."id" = "owner_id" AND "workspace_member"."workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint))));`,
    );

    this.addSql(
      `create policy "account_select_policy" on "account" for select to "authenticated" using ("user_id" = nullif(current_setting('app.auth.user.id', true), '')::bigint);`,
    );

    this.addSql(
      `create policy "workspace_delete_policy" on "workspace" for delete to "authenticated" using ("id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_update_policy" on "workspace" for update to "authenticated" using ("id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint) with check ("id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint);`,
    );

    this.addSql(
      `create policy "workspace_invitation_all_policy" on "workspace_invitation" to "authenticated" using ("workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint) with check ("workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_invitation_recipient_select_policy" on "workspace_invitation" for select to "authenticated" using ("email" = (select lower("recipient"."email") from "user" as "recipient" where "recipient"."id" = nullif(current_setting('app.auth.user.id', true), '')::bigint));`,
    );

    this.addSql(
      `create policy "workspace_member_all_policy" on "workspace_member" to "authenticated" using ("workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint) with check ("workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_member_select_policy" on "workspace_member" for select to "authenticated" using ("user_id" = nullif(current_setting('app.auth.user.id', true), '')::bigint);`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop policy "account_select_policy" on "account";`);

    this.addSql(`drop policy "api_key_all_policy" on "api_key";`);

    this.addSql(`drop policy "workspace_update_policy" on "workspace";`);
    this.addSql(`drop policy "workspace_delete_policy" on "workspace";`);

    this.addSql(
      `drop policy "workspace_invitation_all_policy" on "workspace_invitation";`,
    );
    this.addSql(
      `drop policy "workspace_invitation_recipient_select_policy" on "workspace_invitation";`,
    );

    this.addSql(
      `drop policy "workspace_member_select_policy" on "workspace_member";`,
    );
    this.addSql(
      `drop policy "workspace_member_all_policy" on "workspace_member";`,
    );

    this.addSql(
      `create policy "account_select_policy" on "account" for select to "authenticated" using ("user_id" = nullif(current_setting('app.user.id', true), '')::bigint);`,
    );

    this.addSql(
      `create policy "api_key_all_policy" on "api_key" to "authenticated" using ((("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.user.id', true), '')::bigint) OR ("owner_type" = 'workspace_member' AND EXISTS (SELECT 1 FROM "workspace_member" WHERE "workspace_member"."id" = "owner_id" AND "workspace_member"."workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint)))) with check ((("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.user.id', true), '')::bigint) OR ("owner_type" = 'workspace_member' AND EXISTS (SELECT 1 FROM "workspace_member" WHERE "workspace_member"."id" = "owner_id" AND "workspace_member"."workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint))));`,
    );

    this.addSql(
      `create policy "workspace_update_policy" on "workspace" for update to "authenticated" using ("id" = nullif(current_setting('app.workspace.id', true), '')::bigint) with check ("id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_delete_policy" on "workspace" for delete to "authenticated" using ("id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );

    this.addSql(
      `create policy "workspace_invitation_all_policy" on "workspace_invitation" to "authenticated" using ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint) with check ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_invitation_recipient_select_policy" on "workspace_invitation" for select to "authenticated" using ("email" = (select lower("recipient"."email") from "user" as "recipient" where "recipient"."id" = nullif(current_setting('app.user.id', true), '')::bigint));`,
    );

    this.addSql(
      `create policy "workspace_member_select_policy" on "workspace_member" for select to "authenticated" using ("user_id" = nullif(current_setting('app.user.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_member_all_policy" on "workspace_member" to "authenticated" using ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint) with check ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );
  }
}
