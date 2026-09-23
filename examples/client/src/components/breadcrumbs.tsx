import { useMemo } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { uniqBy } from "lodash";
import type { LinkComponentProps } from "@tanstack/react-router";
import type { FC } from "react";
import {
  BreadcrumbAction,
  BreadcrumbActions,
} from "@/components/thread-ui/page";

import { Link } from "@/components/link";

export interface BreadcrumbsItemProps {
  title: string;
  link: LinkComponentProps<"a">;
}

export interface BreadcrumbsProps {
  baseItems?: Array<BreadcrumbsItemProps>;
}

export const Breadcrumbs: FC<BreadcrumbsProps> = ({ baseItems = [] }) => {
  const { buildLocation } = useRouter();

  const matches = useRouterState({ select: (state) => state.matches });

  const breadcrumbs = useMemo(() => {
    const allItems = [
      ...baseItems.map((item) => ({
        title: item.title,
        path: buildLocation(item.link).pathname,
      })),
      ...matches
        .map(({ pathname, context }) => {
          if (!context.title) {
            return null;
          }

          return {
            title: context.title,
            path: pathname,
          };
        })
        .filter(
          (item): item is { title: string; path: string } => item !== null,
        ),
    ];

    const breadcrumbs = uniqBy(allItems, (item) =>
      item.path.replace(/\/+$/, ""),
    );

    breadcrumbs.pop();
    return breadcrumbs;
  }, [matches, baseItems, buildLocation]);

  return (
    <BreadcrumbActions>
      {breadcrumbs.map((breadcrumb) => (
        <BreadcrumbAction
          key={breadcrumb.path}
          render={<Link to={breadcrumb.path} />}
        >
          {breadcrumb.title}
        </BreadcrumbAction>
      ))}
    </BreadcrumbActions>
  );
};
