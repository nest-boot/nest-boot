"use client";

import { cva } from "class-variance-authority";
import { MoreHorizontalIcon } from "lucide-react";
import { Children, isValidElement } from "react";
import { useTranslation } from "react-i18next";
import type {
  AriaAttributes,
  ComponentProps,
  FC,
  ReactElement,
  ReactNode,
} from "react";
import type { VariantProps } from "class-variance-authority";

import type { DataAttributes } from "@/components/thread-ui/common";
import { Button } from "@/components/thread-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const pageVariants = cva(
  "mx-auto flex min-h-min w-full flex-1 flex-col p-4 @container/page",
  {
    variants: {
      variant: {
        full: "w-full",
        default: "max-w-5xl",
        compact: "max-w-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type PageProps = ComponentProps<"div"> &
  VariantProps<typeof pageVariants>;

export const Page: FC<PageProps> = ({ className, variant, ...props }) => {
  return (
    <div className={cn(pageVariants({ variant }), className)} {...props} />
  );
};

export type PageHeaderProps = ComponentProps<"header">;

export const PageHeader: FC<PageHeaderProps> = ({ className, ...props }) => {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "group/page-header grid grid-cols-[minmax(0,1fr)] items-center gap-1 pb-4 has-data-[slot=page-actions]:grid-cols-[minmax(0,1fr)_auto] has-data-[slot=page-breadcrumb-actions]:grid-cols-[auto_minmax(0,1fr)] has-data-[slot=page-breadcrumb-actions]:has-data-[slot=page-actions]:grid-cols-[auto_minmax(0,1fr)_auto]",
        className,
      )}
      {...props}
    />
  );
};

export type PageActionProps = Omit<
  ComponentProps<typeof Button>,
  "size" | "variant" | "className"
> & {
  className?: string;
};

export type PagePrimaryActionProps = PageActionProps;

export const PagePrimaryAction: FC<PagePrimaryActionProps> = ({
  className,
  ...props
}) => {
  return (
    <Button
      {...props}
      className={cn("order-last", className)}
      data-slot="page-primary-action"
      variant="default"
    />
  );
};

export type PageSecondaryActionProps = Pick<
  PageActionProps,
  "className" | "disabled" | "title"
> &
  AriaAttributes &
  DataAttributes & {
    children: ReactNode;
    destructive?: boolean;
    icon?: ReactNode;
    onAction?: () => void;
  };

export const PageSecondaryAction: FC<PageSecondaryActionProps> = () => {
  return null;
};

const isPageSecondaryActionElement = (
  child: ReactNode,
): child is ReactElement<
  PageSecondaryActionProps,
  typeof PageSecondaryAction
> => isValidElement(child) && child.type === PageSecondaryAction;

export type PageTitleProps = ComponentProps<"h2">;

export const PageTitle: FC<PageTitleProps> = ({ className, ...props }) => {
  return (
    <h2
      data-slot="page-title"
      className={cn(
        "col-start-1 row-start-1 min-w-0 truncate py-0.5 text-lg font-semibold tracking-tight group-has-data-[slot=page-breadcrumb-actions]/page-header:col-start-2 sm:text-xl",
        className,
      )}
      {...props}
    />
  );
};

export type PageDescriptionProps = ComponentProps<"p">;

export const PageDescription: FC<PageDescriptionProps> = ({
  className,
  ...props
}) => {
  return (
    <p
      data-slot="page-description"
      className={cn(
        "text-muted-foreground col-span-full row-start-2 min-w-0 text-sm wrap-anywhere sm:group-has-data-[slot=page-breadcrumb-actions]/page-header:col-start-2",
        className,
      )}
      {...props}
    />
  );
};

export type PageActionsProps = Omit<
  ComponentProps<"div">,
  "children" | "data-slot"
> & {
  children?: ReactNode;
  secondaryMenuLabel?: string;
};

export const PageActions: FC<PageActionsProps> = ({
  children,
  className,
  secondaryMenuLabel,
  ...props
}) => {
  const { t } = useTranslation("thread-ui");
  const menuLabel = secondaryMenuLabel ?? t("page.moreActions", "More actions");
  const secondaryActions: Array<
    ReactElement<PageSecondaryActionProps, typeof PageSecondaryAction>
  > = [];
  const actionChildren = Children.toArray(children).filter((child) => {
    if (isPageSecondaryActionElement(child)) {
      secondaryActions.push(child);
      return false;
    }

    return true;
  });
  const inlineSecondaryActions =
    secondaryActions.length > 3
      ? secondaryActions.slice(0, 2)
      : secondaryActions;
  const overflowSecondaryActions =
    secondaryActions.length > 3 ? secondaryActions.slice(2) : [];
  const renderSecondaryButtons = (actions: typeof secondaryActions) =>
    actions.map(
      (
        {
          key,
          props: { children, className, destructive, icon, onAction, ...props },
        },
        index,
      ) => (
        <Button
          key={key ?? index}
          {...props}
          className={className}
          data-slot="page-secondary-action"
          variant={destructive ? "destructive" : "secondary"}
          onClick={() => onAction?.()}
        >
          {icon}
          {children}
        </Button>
      ),
    );
  const renderSecondaryMenuItems = (actions: typeof secondaryActions) =>
    actions.map(
      (
        {
          key,
          props: { children, className, destructive, icon, onAction, ...props },
        },
        index,
      ) => (
        <DropdownMenuItem
          key={key ?? index}
          {...props}
          className={className}
          variant={destructive ? "destructive" : "default"}
          onClick={() => onAction?.()}
        >
          {icon}
          {children}
        </DropdownMenuItem>
      ),
    );

  return (
    <div
      {...props}
      data-slot="page-actions"
      className={cn(
        "col-start-2 row-start-1 flex shrink-0 items-center gap-2 justify-self-end group-has-data-[slot=page-breadcrumb-actions]/page-header:col-start-3 [&>[data-slot=page-primary-action]]:order-last [&>[data-slot=page-secondary-actions]]:order-10",
        className,
      )}
    >
      {actionChildren}
      {secondaryActions.length > 0 ? (
        <div
          className="order-10 flex items-center gap-2"
          data-slot="page-secondary-actions"
        >
          <div className="hidden @3xl/page:flex @3xl/page:items-center @3xl/page:gap-2">
            {renderSecondaryButtons(inlineSecondaryActions)}
          </div>
          <div className="@3xl/page:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label={menuLabel}
                    size="icon"
                    variant="secondary"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {renderSecondaryMenuItems(secondaryActions)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {overflowSecondaryActions.length > 0 ? (
            <div className="hidden @3xl/page:block">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={menuLabel}
                      size="icon"
                      variant="secondary"
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  {renderSecondaryMenuItems(overflowSecondaryActions)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export type PageContentProps = ComponentProps<"div">;

export const PageContent: FC<PageContentProps> = ({ className, ...props }) => {
  return <div className={cn("flex-1", className)} {...props} />;
};

export { BreadcrumbActions, BreadcrumbAction } from "./breadcrumb-actions";
export type {
  BreadcrumbActionsProps,
  BreadcrumbActionProps,
} from "./breadcrumb-actions";
