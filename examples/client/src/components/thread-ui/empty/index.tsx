"use client";

import { isValidElement } from "react";
import type { ComponentProps, FC, ReactNode } from "react";

import { Button } from "@/components/thread-ui/button";
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Empty as EmptyRoot,
  EmptyTitle,
} from "@/components/ui/empty";

export type EmptyActionProps = Omit<
  ComponentProps<typeof Button>,
  "children"
> & {
  "data-testid"?: string;
  icon?: ReactNode;
  label: ReactNode;
};

export type EmptyAction = EmptyActionProps | ReactNode;

export type EmptyProps = Omit<
  ComponentProps<typeof EmptyRoot>,
  "children" | "title"
> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  primaryAction?: EmptyAction;
  secondaryAction?: EmptyAction;
};

const EmptyActionButton: FC<EmptyActionProps> = ({ icon, label, ...props }) => (
  <Button {...props}>
    {icon}
    {label}
  </Button>
);

const isPresentAction = (
  action: EmptyAction | undefined,
): action is EmptyAction =>
  action !== null && action !== undefined && typeof action !== "boolean";

const isEmptyActionProps = (action: EmptyAction): action is EmptyActionProps =>
  typeof action === "object" &&
  action !== null &&
  !isValidElement(action) &&
  "label" in action;

const renderEmptyAction = (
  action: EmptyAction,
  props?: Partial<EmptyActionProps>,
) =>
  isEmptyActionProps(action) ? (
    <EmptyActionButton {...props} {...action} />
  ) : (
    action
  );

export const Empty: FC<EmptyProps> = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  ...props
}) => {
  const hasPrimaryAction = isPresentAction(primaryAction);
  const hasSecondaryAction = isPresentAction(secondaryAction);

  return (
    <EmptyRoot {...props}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>

      {(hasPrimaryAction || hasSecondaryAction) && (
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">
          {hasPrimaryAction && renderEmptyAction(primaryAction)}
          {hasSecondaryAction &&
            renderEmptyAction(secondaryAction, { variant: "outline" })}
        </EmptyContent>
      )}
    </EmptyRoot>
  );
};
