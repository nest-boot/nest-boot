import React from "react";
import { createLink } from "@tanstack/react-router";
import type { LinkComponent } from "@tanstack/react-router";
import type { ComponentProps } from "react";

const LinkComponent = React.forwardRef<HTMLAnchorElement, ComponentProps<"a">>(
  (props, ref) => <a ref={ref} {...props} />,
);

const CreatedLinkComponent = createLink(LinkComponent);

export const Link: LinkComponent<typeof LinkComponent> = (props) => {
  return (
    <CreatedLinkComponent activeProps={{ "data-active": true }} {...props} />
  );
};
