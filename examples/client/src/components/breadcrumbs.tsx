import { Fragment, useMemo } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { uniqBy } from "lodash";
import type { LinkComponentProps } from "@tanstack/react-router";
import type { FC } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

  const [breadcrumbs, lastBreadcrumb] = useMemo(() => {
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

    const lastBreadcrumb = breadcrumbs.pop();

    return [breadcrumbs, lastBreadcrumb];
  }, [matches, baseItems, buildLocation]);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs?.map((breadcrumb) => (
          <Fragment key={breadcrumb.title}>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                render={<Link to={breadcrumb.path}>{breadcrumb.title}</Link>}
              />
            </BreadcrumbItem>

            <BreadcrumbSeparator className="hidden md:block" />
          </Fragment>
        ))}

        {lastBreadcrumb && (
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">
              {lastBreadcrumb.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
