"use client";

import { cva } from "class-variance-authority";
import { ArrowLeftIcon, MoreHorizontalIcon } from "lucide-react";
import { Children, isValidElement } from "react";
import type { ComponentProps, FC, ReactElement, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

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
        compact: "max-w-xl",
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
        "group/page-header grid gap-1 pb-4 has-data-[slot=page-actions]:grid-cols-[1fr_auto] has-data-[slot=page-back-action]:grid-cols-[1fr_auto] has-data-[slot=page-back-action]:grid-rows-[auto_auto_auto] @3xl/page:has-data-[slot=page-back-action]:grid-cols-[auto_1fr_auto] @3xl/page:has-data-[slot=page-back-action]:grid-rows-[auto_auto] @3xl/page:has-data-[slot=page-back-action]:gap-x-2",
        className,
      )}
      {...props}
    />
  );
};

export interface PageActionProps extends ComponentProps<typeof Button> {
  loading?: boolean;
}

export type PageBackActionProps = PageActionProps;

export const PageBackAction: FC<PageBackActionProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <Button
      {...props}
      data-slot="page-back-action"
      size="icon"
      variant="ghost"
      className={cn(
        "col-start-1 row-start-1 self-start justify-self-start @3xl/page:row-span-2",
        className,
      )}
    >
      {children ?? (
        <>
          <ArrowLeftIcon />
          <span className="sr-only">Back</span>
        </>
      )}
    </Button>
  );
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

export type PageSecondaryActionProps = {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onAction?: () => void;
  render?: ReactElement;
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
        "py-0.5 text-2xl font-semibold tracking-tight group-has-data-[slot=page-back-action]/page-header:col-span-2 group-has-data-[slot=page-back-action]/page-header:row-start-2 @3xl/page:group-has-data-[slot=page-back-action]/page-header:col-span-1 @3xl/page:group-has-data-[slot=page-back-action]/page-header:col-start-2 @3xl/page:group-has-data-[slot=page-back-action]/page-header:row-start-1",
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
        "text-muted-foreground text-sm group-has-data-[slot=page-back-action]/page-header:col-span-2 group-has-data-[slot=page-back-action]/page-header:row-start-3 @3xl/page:group-has-data-[slot=page-back-action]/page-header:col-span-1 @3xl/page:group-has-data-[slot=page-back-action]/page-header:col-start-2 @3xl/page:group-has-data-[slot=page-back-action]/page-header:row-start-2",
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
  secondaryMenuLabel = "More actions",
  ...props
}) => {
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
    actions.map(({ key, props: action }, index) => {
      const {
        children,
        className,
        destructive,
        icon,
        onAction,
        ...buttonProps
      } = action;

      return (
        <Button
          key={key ?? index}
          {...buttonProps}
          className={className}
          data-slot="page-secondary-action"
          variant={destructive ? "destructive" : "secondary"}
          onClick={() => onAction?.()}
        >
          {icon}
          {children}
        </Button>
      );
    });
  const renderSecondaryMenuItems = (actions: typeof secondaryActions) =>
    actions.map(({ key, props: action }, index) => {
      const { children, className, destructive, icon, onAction, ...itemProps } =
        action;

      return (
        <DropdownMenuItem
          key={key ?? index}
          {...itemProps}
          className={className}
          variant={destructive ? "destructive" : "default"}
          onClick={() => onAction?.()}
        >
          {icon}
          {children}
        </DropdownMenuItem>
      );
    });

  return (
    <div
      {...props}
      data-slot="page-actions"
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start justify-self-end group-has-data-[slot=page-back-action]/page-header:row-span-1 @3xl/page:group-has-data-[slot=page-back-action]/page-header:col-start-3 @3xl/page:group-has-data-[slot=page-back-action]/page-header:row-span-2 [&>[data-slot=page-primary-action]]:order-last [&>[data-slot=page-secondary-actions]]:order-10",
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
                  <Button size="icon" variant="secondary">
                    <MoreHorizontalIcon />
                    <span className="sr-only">{secondaryMenuLabel}</span>
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
                    <Button size="icon" variant="secondary">
                      <MoreHorizontalIcon />
                      <span className="sr-only">{secondaryMenuLabel}</span>
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
