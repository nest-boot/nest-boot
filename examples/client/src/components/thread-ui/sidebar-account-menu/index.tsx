"use client";

import { Building2Icon, ChevronsUpDownIcon } from "lucide-react";
import { Children } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";

export type Workspace = Pick<
  ComponentProps<typeof DropdownMenuRadioItem>,
  "render" | "onClick" | "disabled"
> & {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
};

export type SidebarAccountMenuUserConfig = Omit<
  ComponentProps<typeof DropdownMenuItem>,
  "children" | "className"
> & {
  name: string;
  email?: string;
  avatar?: ReactNode;
  className?: string;
};

export type SidebarAccountMenuProps = Pick<
  ComponentProps<typeof DropdownMenu>,
  "open" | "defaultOpen" | "onOpenChange" | "onOpenChangeComplete"
> & {
  /** Additional menu items, rendered after workspaces and user identity. */
  children?: ReactNode;
  workspace?: Workspace;
  recentWorkspaces?: ReadonlyArray<Workspace>;
  /** Maximum visible workspaces, including the current one. Defaults to 3; 0 hides the list. */
  maxRecentWorkspaces?: number;
  onWorkspaceChange?: ComponentProps<
    typeof DropdownMenuRadioGroup
  >["onValueChange"];
  /** Defaults to the translated Recent workspaces label; null hides it. */
  workspaceLabel?: ReactNode;
  user?: SidebarAccountMenuUserConfig;
  /** Customize the trigger element using the Base UI render contract. */
  render?: ComponentProps<typeof DropdownMenuTrigger>["render"];
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

function UserAvatar({
  user,
}: {
  user: NonNullable<SidebarAccountMenuProps["user"]>;
}) {
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

/** Identity uses props; children compose additional menu actions. */
export function SidebarAccountMenu(props: SidebarAccountMenuProps) {
  return (
    <DropdownMenu
      defaultOpen={props.defaultOpen}
      open={props.open}
      onOpenChange={props.onOpenChange}
      onOpenChangeComplete={props.onOpenChangeComplete}
    >
      <AccountMenuTrigger config={props} render={props.render} />
      <AccountMenuContent config={props}>{props.children}</AccountMenuContent>
    </DropdownMenu>
  );
}

type AccountMenuTriggerProps = Omit<
  ComponentProps<typeof DropdownMenuTrigger>,
  "className"
> & { className?: string };
function AccountMenuTrigger({
  config,
  children,
  className,
  ...props
}: AccountMenuTriggerProps & { config: SidebarAccountMenuProps }) {
  const { t } = useTranslation("thread-ui");
  const selected = config.workspace;
  const user = config.user;
  const description = selected ? selected.description : user?.email;
  const label =
    selected?.name ??
    config.user?.name ??
    t("sidebarAccountMenu.choose", "Choose workspace");
  return (
    <DropdownMenuTrigger
      aria-busy={config.loading || undefined}
      aria-haspopup="menu"
      aria-label={t(
        !selected && user
          ? "sidebarAccountMenu.userMenu"
          : config.user
            ? "sidebarAccountMenu.accountMenu"
            : "sidebarAccountMenu.switch",
        {
          defaultValue:
            !selected && user
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
        buttonVariants({ variant: "ghost" }),
        "bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground relative h-12 w-full justify-start gap-2 rounded-lg px-2 text-left group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
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
            {selected || !user ? (
              <WorkspaceIcon workspace={selected} />
            ) : (
              <UserAvatar user={user} />
            )}
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate">{label}</span>
              {description && (
                <span className="text-muted-foreground group-hover/button:text-sidebar-accent-foreground group-aria-expanded/button:text-sidebar-accent-foreground block truncate text-xs font-normal">
                  {description}
                </span>
              )}
            </span>
            <ChevronsUpDownIcon
              aria-hidden="true"
              className="size-4 shrink-0 group-data-[collapsible=icon]:hidden"
            />
          </>
        )}
      </span>
    </DropdownMenuTrigger>
  );
}

type AccountMenuContentProps = ComponentProps<typeof DropdownMenuContent>;
function AccountMenuContent({
  config,
  children,
  className,
  ...props
}: AccountMenuContentProps & { config: SidebarAccountMenuProps }) {
  const isMobile = useIsMobile();
  const selected = config.workspace;
  const recentWorkspaces = [
    ...new Map(
      [...(config.recentWorkspaces ?? [])].map((workspace) => [
        workspace.id,
        workspace,
      ]),
    ).values(),
  ];
  const mergedWorkspaces = selected
    ? [
        {
          ...recentWorkspaces.find((workspace) => workspace.id === selected.id),
          ...selected,
        },
        ...recentWorkspaces.filter((workspace) => workspace.id !== selected.id),
      ]
    : recentWorkspaces;
  const limit = config.maxRecentWorkspaces ?? 3;
  const visibleWorkspaces = mergedWorkspaces.slice(
    0,
    Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3,
  );
  const hasWorkspaces = visibleWorkspaces.length > 0;
  const hasChildren = Children.toArray(children).length > 0;
  return (
    <DropdownMenuContent
      align={isMobile ? "start" : "end"}
      side={isMobile ? "top" : "right"}
      sideOffset={8}
      {...props}
      className={cn(
        "w-72 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain",
        className,
      )}
    >
      {hasWorkspaces && (
        <WorkspaceGroup
          value={selected?.id ?? ""}
          onValueChange={config.onWorkspaceChange}
        >
          <WorkspaceLabel>{config.workspaceLabel}</WorkspaceLabel>
          {visibleWorkspaces.map((workspace) => (
            <WorkspaceItem key={workspace.id} workspace={workspace} />
          ))}
        </WorkspaceGroup>
      )}
      {hasWorkspaces && config.user && <DropdownMenuSeparator />}
      {config.user && <UserRow {...config.user} />}
      {(hasWorkspaces || config.user) && hasChildren && (
        <DropdownMenuSeparator />
      )}
      {children}
    </DropdownMenuContent>
  );
}

/** Workspace choices use native shadcn radio items as children. */
type WorkspaceGroupProps = ComponentProps<typeof DropdownMenuRadioGroup>;
function WorkspaceGroup(props: WorkspaceGroupProps) {
  const { t } = useTranslation("thread-ui");
  return (
    <DropdownMenuGroup>
      <DropdownMenuRadioGroup
        aria-label={t(
          "sidebarAccountMenu.recentWorkspaces",
          "Recent workspaces",
        )}
        {...props}
      />
    </DropdownMenuGroup>
  );
}

type WorkspaceLabelProps = ComponentProps<typeof DropdownMenuLabel>;
function WorkspaceLabel({ children, ...props }: WorkspaceLabelProps) {
  const { t } = useTranslation("thread-ui");
  if (children === null || children === false) return null;
  return (
    <DropdownMenuLabel {...props}>
      {children === undefined
        ? t("sidebarAccountMenu.recentWorkspaces", "Recent workspaces")
        : children}
    </DropdownMenuLabel>
  );
}

type WorkspaceItemProps = Omit<
  ComponentProps<typeof DropdownMenuRadioItem>,
  "value"
> & {
  workspace: Workspace;
};
function WorkspaceItem({
  workspace,
  children,
  className,
  disabled,
  ...props
}: WorkspaceItemProps) {
  return (
    <DropdownMenuRadioItem
      closeOnClick
      aria-label={workspace.name}
      render={workspace.render}
      onClick={workspace.onClick}
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

function UserRow({
  name,
  email,
  avatar,
  className,
  render,
  onClick,
  "aria-label": ariaLabel,
  ...props
}: SidebarAccountMenuUserConfig) {
  const { t } = useTranslation("thread-ui");
  const interactive = Boolean(onClick || render);
  const rowClassName = cn(
    "text-foreground flex min-h-12 items-center gap-2 px-2 py-1.5",
    className,
  );
  const content = (
    <>
      <UserAvatar user={{ name, email, avatar }} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        {email && (
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {email}
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
            t("sidebarAccountMenu.profile", {
              defaultValue: "Open profile: {{name}}",
              name: name,
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

export { DropdownMenuSeparator as SidebarAccountMenuSeparator };
export type SidebarAccountMenuSeparatorProps = ComponentProps<
  typeof DropdownMenuSeparator
>;

export { DropdownMenuItem as SidebarAccountMenuItem };
export type SidebarAccountMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;

export {
  DropdownMenuSub as SidebarAccountMenuSub,
  DropdownMenuSubTrigger as SidebarAccountMenuSubTrigger,
  DropdownMenuSubContent as SidebarAccountMenuSubContent,
  DropdownMenuRadioGroup as SidebarAccountMenuRadioGroup,
  DropdownMenuRadioItem as SidebarAccountMenuRadioItem,
};
export type SidebarAccountMenuSubProps = ComponentProps<typeof DropdownMenuSub>;
export type SidebarAccountMenuSubTriggerProps = ComponentProps<
  typeof DropdownMenuSubTrigger
>;
export type SidebarAccountMenuSubContentProps = ComponentProps<
  typeof DropdownMenuSubContent
>;
export type SidebarAccountMenuRadioGroupProps = ComponentProps<
  typeof DropdownMenuRadioGroup
>;
export type SidebarAccountMenuRadioItemProps = ComponentProps<
  typeof DropdownMenuRadioItem
>;
