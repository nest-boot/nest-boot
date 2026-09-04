"use client";

import type { ComponentProps, FC } from "react";

import { Button as ButtonComponent } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ButtonProps = ComponentProps<typeof ButtonComponent> & {
  loading?: boolean;
};

export const Button: FC<ButtonProps> = ({
  loading,
  disabled,
  className,
  children,
  ...props
}) => {
  return (
    <ButtonComponent
      className={cn("group/button relative", className)}
      data-loading={loading}
      disabled={loading || disabled}
      {...props}
    >
      <span className="absolute inset-0 hidden items-center justify-center group-data-[loading=true]/button:flex">
        <Spinner />
      </span>

      <span className="contents group-data-[loading=true]/button:invisible">
        {children}
      </span>
    </ButtonComponent>
  );
};
