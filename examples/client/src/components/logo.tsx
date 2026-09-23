import type { ComponentProps } from "react";

export function Logo(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" {...props}>
      <rect width="96" height="96" rx="22" className="fill-primary" />
      <path
        d="M26 69V27h11l22 25V27h11v42H59L37 44v25H26Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}
