"use client";

import { Building2Icon, ChevronsUpDownIcon } from "lucide-react";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentProps, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type TopbarMenuProps = Pick<
  ComponentProps<typeof DropdownMenu>,
  "open" | "defaultOpen" | "onOpenChange" | "onOpenChangeComplete"
> & {
  children: ReactNode;
  currentWorkspace?: Workspace;
  user?: { name: string; email?: string; avatar?: ReactNode };
  disabled?: boolean;
  loading?: boolean;
};

function getInitial(name: string) {
  return Array.from(name.trim().toUpperCase())[0] ?? "?";
}

function WorkspaceIcon({ workspace }: { workspace?: Workspace }) {
  return (
    <Avatar
      aria-hidden="true"
      className="bg-primary text-primary-foreground items-center justify-center overflow-hidden [&_img]:size-full [&_img]:object-cover [&_svg]:size-4"
      data-slot="workspace-icon"
    >
      {workspace?.icon}
      <AvatarFallback
        className="bg-primary text-primary-foreground text-xs font-semibold"
        // Icons leave the image idle; AvatarImage reports loading/error/loaded.
        render={(props: ComponentProps<"span">, state) => (
          <span
            {...props}
            className={cn(
              props.className,
              workspace?.icon != null &&
                state.imageLoadingStatus === "idle" &&
                "hidden",
            )}
          />
        )}
      >
        {workspace ? getInitial(workspace.name) : <Building2Icon />}
      </AvatarFallback>
    </Avatar>
  );
}

function UserAvatar({ user }: { user: NonNullable<TopbarMenuProps["user"]> }) {
  return (
    <Avatar
      aria-hidden="true"
      className="bg-muted text-foreground items-center justify-center overflow-hidden [&_img]:size-full [&_img]:object-cover [&_svg]:size-4"
      data-slot="user-avatar"
    >
      {user.avatar}
      <AvatarFallback
        className="text-foreground text-xs font-semibold"
        render={(props: ComponentProps<"span">, state) => (
          <span
            {...props}
            className={cn(
              props.className,
              user.avatar != null &&
                state.imageLoadingStatus === "idle" &&
                "hidden",
            )}
          />
        )}
      >
        {getInitial(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

type MenuContextValue = {
  props: TopbarMenuProps;
  selected?: Workspace;
};
const MenuContext = createContext<MenuContextValue | null>(null);
function useTopbarMenu() {
  const context = useContext(MenuContext);
  if (!context) throw new Error("TopbarMenu parts must be inside TopbarMenu.");
  return context;
}

/** Composition only: children explicitly declare the trigger and menu. */
export function TopbarMenu(props: TopbarMenuProps) {
  const selected = props.currentWorkspace;
  return (
    <MenuContext.Provider value={{ props, selected }}>
      <DropdownMenu
        defaultOpen={props.defaultOpen}
        open={props.open}
        onOpenChange={props.onOpenChange}
        onOpenChangeComplete={props.onOpenChangeComplete}
      >
        {props.children}
      </DropdownMenu>
    </MenuContext.Provider>
  );
}

export type TopbarMenuTriggerProps = Omit<
  ComponentProps<typeof DropdownMenuTrigger>,
  "className"
> & { className?: string };
export function TopbarMenuTrigger({
  children,
  className,
  ...props
}: TopbarMenuTriggerProps) {
  const { t } = useTranslation("thread-ui");
  const { props: config, selected } = useTopbarMenu();
  const userOnly = !selected && config.user;
  const label =
    selected?.name ??
    config.user?.name ??
    t("topbarMenu.choose", "Choose workspace");
  return (
    <DropdownMenuTrigger
      aria-busy={config.loading || undefined}
      aria-haspopup="menu"
      aria-label={t(
        userOnly
          ? "topbarMenu.userMenu"
          : config.user
            ? "topbarMenu.accountMenu"
            : "topbarMenu.switch",
        {
          defaultValue: userOnly
            ? "Account: {{name}}"
            : config.user
              ? "Workspace and account: {{name}}"
              : "Switch workspace: {{name}}",
          name: label,
        },
      )}
      {...props}
      data-loading={config.loading}
      disabled={config.disabled || config.loading || props.disabled}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "relative h-10 max-w-full gap-2",
        children === undefined &&
          "p-1 max-sm:w-10 max-sm:rounded-full max-sm:p-0 sm:pr-2",
        "border-border bg-topbar text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring aria-expanded:bg-accent aria-expanded:text-accent-foreground dark:bg-topbar dark:hover:bg-accent",
        className,
      )}
    >
      <span className="absolute inset-0 hidden items-center justify-center group-data-[loading=true]/button:flex">
        <Spinner />
      </span>
      <span className="contents group-data-[loading=true]/button:invisible">
        {children !== undefined ? (
          children
        ) : (
          <>
            {userOnly ? (
              <UserAvatar user={userOnly} />
            ) : (
              <WorkspaceIcon workspace={selected} />
            )}
            <span className="hidden max-w-40 truncate sm:block">{label}</span>
            <ChevronsUpDownIcon
              aria-hidden="true"
              className="hidden size-4 shrink-0 sm:block"
            />
          </>
        )}
      </span>
    </DropdownMenuTrigger>
  );
}

export type TopbarMenuContentProps = ComponentProps<typeof DropdownMenuContent>;
export function TopbarMenuContent({
  className,
  ...props
}: TopbarMenuContentProps) {
  return (
    <DropdownMenuContent
      align="end"
      sideOffset={8}
      {...props}
      className={cn(
        "w-72 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain",
        className,
      )}
    />
  );
}

/** Workspace choices use native shadcn radio items as children. */
export type TopbarMenuWorkspaceGroupProps = ComponentProps<
  typeof DropdownMenuRadioGroup
>;
export function TopbarMenuWorkspaceGroup(props: TopbarMenuWorkspaceGroupProps) {
  const { t } = useTranslation("thread-ui");
  return (
    <DropdownMenuGroup>
      <DropdownMenuRadioGroup
        aria-label={t("topbarMenu.recentWorkspaces", "Recent workspaces")}
        {...props}
      />
    </DropdownMenuGroup>
  );
}

export type TopbarMenuWorkspaceLabelProps = ComponentProps<
  typeof DropdownMenuLabel
>;
export function TopbarMenuWorkspaceLabel({
  children,
  ...props
}: TopbarMenuWorkspaceLabelProps) {
  const { t } = useTranslation("thread-ui");
  return (
    <DropdownMenuLabel {...props}>
      {children === undefined
        ? t("topbarMenu.recentWorkspaces", "Recent workspaces")
        : children}
    </DropdownMenuLabel>
  );
}

export type TopbarMenuWorkspaceItemProps = Omit<
  ComponentProps<typeof DropdownMenuRadioItem>,
  "value"
> & {
  workspace: Workspace;
};
export function TopbarMenuWorkspaceItem({
  workspace,
  children,
  className,
  disabled,
  ...props
}: TopbarMenuWorkspaceItemProps) {
  return (
    <DropdownMenuRadioItem
      closeOnClick
      aria-label={workspace.name}
      {...props}
      disabled={workspace.disabled || disabled}
      value={workspace.id}
      className={cn(
        "focus:[&_[data-slot=workspace-icon]]:text-primary-foreground focus:[&_[data-slot=workspace-icon]_*]:text-primary-foreground min-h-12 gap-2",
        className,
      )}
    >
      {children ?? (
        <>
          <WorkspaceIcon workspace={workspace} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{workspace.name}</span>
            {workspace.description && (
              <span className="text-muted-foreground block truncate text-xs">
                {workspace.description}
              </span>
            )}
          </span>
        </>
      )}
    </DropdownMenuRadioItem>
  );
}

export type TopbarMenuUserProps = Omit<
  ComponentProps<typeof DropdownMenuItem>,
  "children" | "className"
> & {
  user?: TopbarMenuProps["user"];
  className?: string;
};
export function TopbarMenuUser({
  user: suppliedUser,
  className,
  render,
  onClick,
  "aria-label": ariaLabel,
  ...props
}: TopbarMenuUserProps) {
  const { t } = useTranslation("thread-ui");
  const {
    props: { user: contextUser },
  } = useTopbarMenu();
  const user = suppliedUser ?? contextUser;
  if (!user) return null;
  const interactive = Boolean(onClick || render);
  const rowClassName = cn(
    "text-foreground flex min-h-12 items-center gap-2 px-2 py-1.5",
    className,
  );
  const content = (
    <>
      <UserAvatar user={user} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{user.name}</span>
        {user.email && (
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {user.email}
          </span>
        )}
      </span>
    </>
  );
  // The informational row forwards DOM props without leaking menu-item options.
  const {
    disabled,
    closeOnClick: _closeOnClick,
    label: _label,
    nativeButton: _nativeButton,
    variant: _variant,
    style,
    ...labelProps
  } = props;
  const informationalProps = interactive
    ? undefined
    : {
        ...labelProps,
        style:
          typeof style === "function"
            ? style({ disabled: disabled ?? false, highlighted: false })
            : style,
      };
  return (
    <DropdownMenuGroup>
      {interactive ? (
        <DropdownMenuItem
          {...props}
          className={rowClassName}
          render={render}
          aria-label={
            ariaLabel ??
            t("topbarMenu.profile", {
              defaultValue: "Open profile: {{name}}",
              name: user.name,
            })
          }
          onClick={onClick}
        >
          {content}
        </DropdownMenuItem>
      ) : (
        <DropdownMenuLabel
          {...informationalProps}
          aria-label={ariaLabel}
          className={rowClassName}
        >
          {content}
        </DropdownMenuLabel>
      )}
    </DropdownMenuGroup>
  );
}

export { DropdownMenuSeparator as TopbarMenuSeparator };
export type TopbarMenuSeparatorProps = ComponentProps<
  typeof DropdownMenuSeparator
>;

export { DropdownMenuItem as TopbarMenuItem };
export type TopbarMenuItemProps = ComponentProps<typeof DropdownMenuItem>;

export {
  DropdownMenuSub as TopbarMenuSub,
  DropdownMenuSubTrigger as TopbarMenuSubTrigger,
  DropdownMenuSubContent as TopbarMenuSubContent,
  DropdownMenuRadioGroup as TopbarMenuRadioGroup,
  DropdownMenuRadioItem as TopbarMenuRadioItem,
};
export type TopbarMenuSubProps = ComponentProps<typeof DropdownMenuSub>;
export type TopbarMenuSubTriggerProps = ComponentProps<
  typeof DropdownMenuSubTrigger
>;
export type TopbarMenuSubContentProps = ComponentProps<
  typeof DropdownMenuSubContent
>;
export type TopbarMenuRadioGroupProps = ComponentProps<
  typeof DropdownMenuRadioGroup
>;
export type TopbarMenuRadioItemProps = ComponentProps<
  typeof DropdownMenuRadioItem
>;
