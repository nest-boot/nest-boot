import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircleMinus,
  CirclePlus,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

import { useQuery } from "@apollo/client/react";
import { t } from "i18next";
import { useDebounce } from "react-use";
import { Button } from "@/components/thread-ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { graphql } from "@/gql";
import { WorkspaceMemberStatus } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import { truncateEmail } from "@/utils/truncate-email";

const GET_WORKSPACE_MEMBERS_FROM_WORKSPACE_MEMBER_GROUP_MEMBERS_MANAGER =
  graphql(`
    query getWorkspaceMembersFromWorkspaceMemberGroupMembersManager(
      $after: String
      $before: String
      $first: Int
      $last: Int
      $orderBy: WorkspaceMemberOrder
      $query: String
    ) {
      workspaceMembers(
        after: $after
        before: $before
        first: $first
        last: $last
        orderBy: $orderBy
        query: $query
      ) {
        edges {
          node {
            id
            name
            email
            status
            user {
              id
              name
              email
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
        totalCount
      }
    }
  `);

export interface WorkspaceMemberGroupMembersManagerProps {
  addedMembers: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
    } | null;
  }>;
  isCreate: boolean;
  loading?: boolean;
  addLoading?: boolean;
  removeLoading?: boolean;
  onAdd: (memberId: string) => void | Promise<void>;
  onDelete: (memberId: string) => void | Promise<void>;
}

export function WorkspaceMemberGroupMembersManager({
  addedMembers,
  loading = false,
  addLoading = false,
  removeLoading = false,
  isCreate,
  onAdd,
  onDelete,
}: WorkspaceMemberGroupMembersManagerProps) {
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

  // 搜索状态
  const [searchQuery] = useState("");
  const [dialogSearchQuery, setDialogSearchQuery] = useState("");
  const [debouncedDialogSearchQuery, setDebouncedDialogSearchQuery] =
    useState("");
  const dialogSearchInputRef = useRef<HTMLInputElement>(null);

  // 构建 GraphQL query 字符串
  const buildSearchQuery = useCallback(
    (searchText: string): string | undefined => {
      if (!searchText.trim()) {
        return undefined;
      }
      // 转义单引号
      const escapedText = searchText.replace(/'/g, "''");
      // 构建格式：name:'搜索内容' or email:'搜索内容'
      return `name:'${escapedText}' or email:'${escapedText}'`;
    },
    [],
  );

  // 使用 debounce 优化搜索
  useDebounce(
    () => {
      setDebouncedDialogSearchQuery(dialogSearchQuery);
    },
    1000,
    [dialogSearchQuery],
  );

  // 查询工作空间成员（支持搜索）
  const searchQueryString = useMemo(
    () => buildSearchQuery(debouncedDialogSearchQuery),
    [debouncedDialogSearchQuery, buildSearchQuery],
  );

  const { data: allMembersData, loading: allMembersLoading } = useQuery(
    GET_WORKSPACE_MEMBERS_FROM_WORKSPACE_MEMBER_GROUP_MEMBERS_MANAGER,
    {
      variables: {
        first: 500,
        query: searchQueryString,
      },
      skip: !addMemberDialogOpen, // 只在对话框打开时查询
      fetchPolicy: "cache-and-network",
    },
  );

  // 获取所有工作空间成员
  const allMembers = useMemo(() => {
    if (!allMembersData?.workspaceMembers?.edges) {
      return [];
    }

    return allMembersData.workspaceMembers.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      email: edge.node.email,
      status: edge.node.status,
      user: edge.node.user,
    }));
  }, [allMembersData]);

  // 过滤掉待接受邀请的成员
  const allValidMembers = useMemo(() => {
    return allMembers.filter(
      (member) => member.status !== WorkspaceMemberStatus.INVITING,
    );
  }, [allMembers]);

  // 获取已添加的成员 ID 列表
  const addedMemberIds = useMemo(() => {
    return addedMembers.map((member) => member.id);
  }, [addedMembers]);

  // 获取可用的成员（未添加到组中的）
  const availableMembers = useMemo(() => {
    const filtered = allValidMembers.filter(
      (member) => !addedMemberIds.includes(member.id),
    );

    return [...filtered];
  }, [allValidMembers, addedMemberIds]);

  // 判断空状态类型
  const emptyStateType = useMemo(() => {
    const hasSearchQuery = debouncedDialogSearchQuery.trim().length > 0;
    if (availableMembers.length === 0) {
      if (hasSearchQuery) {
        // 有搜索关键词但没有匹配结果
        return "no_search_results";
      } else {
        // 没有搜索关键词，说明所有成员都已添加（或者工作空间没有成员）
        return "all_added";
      }
    }
    return null;
  }, [debouncedDialogSearchQuery, availableMembers.length]);

  // 过滤已添加的成员（根据搜索关键词）
  const filteredAddedMembers = useMemo(() => {
    const allAddedMembers = [...addedMembers];

    if (!searchQuery.trim()) {
      return allAddedMembers;
    }
    const query = searchQuery.toLowerCase();
    return allAddedMembers.filter(
      (member) =>
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.user?.email?.toLowerCase().includes(query),
    );
  }, [addedMembers, searchQuery]);

  // 当对话框打开时，聚焦搜索框
  useEffect(() => {
    if (addMemberDialogOpen) {
      // 延迟聚焦，确保对话框已渲染
      setTimeout(() => {
        dialogSearchInputRef.current?.focus();
      }, 100);
    } else {
      // 关闭对话框时清空搜索
      setDialogSearchQuery("");
      setDebouncedDialogSearchQuery("");
    }
  }, [addMemberDialogOpen]);

  const handleRemoveMemberClick = async (memberId: string) => {
    if (isCreate) {
      // 如果是创建，删除工作成员时不需要二次确认删除，直接删除
      await onDelete(memberId);
      return;
    }

    const confirmed = await alertDialog({
      title: t(
        "workspace-member-group:detail.members.management.delete_member.dialog.title",
      ),
      description: t(
        "workspace-member-group:detail.members.management.delete_member.dialog.description",
      ),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });

    if (confirmed) {
      await onDelete(memberId);
    }
  };

  const handleAddMemberInDialog = async (memberId: string) => {
    await onAdd(memberId);
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="member-group-members-manager">
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* 已添加的成员列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            {addedMembers.length > 0 && (
              <>
                <h3 className="text-sm font-medium">
                  {t(
                    "workspace-member-group:detail.members.management.added_members.title",
                  )}
                </h3>
                <Button
                  type="button"
                  data-testid="member-group-add-member-action"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddMemberDialogOpen(true)}
                  disabled={addLoading || removeLoading}
                >
                  <CirclePlus className="h-4 w-4" />
                  {t(
                    "workspace-member-group:detail.members.management.add_member.btn",
                  )}
                </Button>
              </>
            )}
          </div>

          <ScrollArea className={cn("max-h-80 pr-4")}>
            {filteredAddedMembers.length > 0 ? (
              <ItemGroup>
                {filteredAddedMembers.map((member, index) => (
                  <React.Fragment key={member.id}>
                    <Item
                      size="sm"
                      className="px-0"
                      data-testid={`member-group-added-member-${member.id}`}
                    >
                      <ItemMedia>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent className="min-w-0 gap-0.5">
                        <ItemTitle className="line-clamp-1 truncate text-sm">
                          {member.name}
                        </ItemTitle>
                        <ItemDescription className="line-clamp-1 truncate text-xs">
                          {truncateEmail(member.email ?? member.user?.email)}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  data-testid={`member-group-remove-member-${member.id}`}
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full"
                                  onClick={() =>
                                    handleRemoveMemberClick(member.id)
                                  }
                                  disabled={addLoading || removeLoading}
                                >
                                  <CircleMinus className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <TooltipContent>
                              <p>
                                {t(
                                  "workspace-member-group:detail.members.management.delete_member.tooltip",
                                )}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </ItemActions>
                    </Item>
                    {index !== filteredAddedMembers.length - 1 && (
                      <ItemSeparator />
                    )}
                  </React.Fragment>
                ))}
              </ItemGroup>
            ) : (
              <Empty className="gap-4 p-4">
                <Button
                  type="button"
                  data-testid="member-group-add-member-action"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddMemberDialogOpen(true)}
                  disabled={addLoading || removeLoading}
                >
                  <Plus className="h-4 w-4" />
                  {t(
                    "workspace-member-group:detail.members.management.add_member.btn",
                  )}
                </Button>
                <EmptyDescription>
                  {t(
                    "workspace-member-group:detail.members.management.added_members.empty_state.description",
                  )}
                </EmptyDescription>
              </Empty>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* 添加成员对话框 */}
      <Dialog
        open={addMemberDialogOpen}
        onOpenChange={(open) => {
          setAddMemberDialogOpen(open);
          if (!open) {
            // 关闭对话框时清空对话框搜索框
            setDialogSearchQuery("");
            setDebouncedDialogSearchQuery("");
          }
        }}
        modal={true}
      >
        <DialogContent
          data-testid="member-group-add-member-dialog"
          className={cn(
            "flex flex-col",
            "xs:max-w-[100vw] max-w-full sm:max-w-[100vw] md:max-w-200 lg:max-w-200 xl:max-w-200",
            "h-full md:h-[70vh]",
          )}
        >
          <DialogHeader className="text-left">
            <DialogTitle>
              {t(
                "workspace-member-group:detail.members.management.add_member.dialog.title",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "workspace-member-group:detail.members.management.add_member.dialog.description",
              )}
            </DialogDescription>
          </DialogHeader>

          {/* 内容区域 */}
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex rounded-md border">
              {/* 左侧：工作空间全部成员 */}
              <div className="flex w-full flex-col space-y-2">
                <div className="flex flex-col gap-2 p-4">
                  <h3 className="text-sm font-medium">
                    {t(
                      "workspace-member-group:detail.members.management.all_members.title",
                    )}
                  </h3>
                  {/* 搜索框 */}
                  <InputGroup>
                    <InputGroupAddon>
                      <Search className="h-4 w-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      ref={dialogSearchInputRef}
                      placeholder={t(
                        "workspace-member-group:detail.members.search.placeholder",
                      )}
                      value={dialogSearchQuery}
                      onChange={(e) => setDialogSearchQuery(e.target.value)}
                    />
                    {dialogSearchQuery && (
                      <InputGroupAddon align="inline-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDialogSearchQuery("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </InputGroupAddon>
                    )}
                    {allMembersLoading && !dialogSearchQuery && (
                      <InputGroupAddon align="inline-end">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                </div>

                <ScrollArea
                  className={cn(
                    "md:h-[calc(70dvh-18rem)]",
                    "h-[calc(50dvh-12rem)]",
                    "px-4",
                    "w-full",
                  )}
                >
                  {allMembersLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : availableMembers.length > 0 ? (
                    <ItemGroup>
                      {availableMembers.map((member, index) => (
                        <React.Fragment key={member.id}>
                          <Item
                            size="sm"
                            className="px-0"
                            data-testid={`member-group-available-member-${member.id}`}
                          >
                            <ItemMedia className="">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {member.name?.charAt(0)?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                            </ItemMedia>
                            <ItemContent className="max-w-[calc(100%-6rem)] gap-0.5">
                              <ItemTitle className="line-clamp-1 truncate text-sm">
                                {member.name}
                              </ItemTitle>
                              <ItemDescription className="line-clamp-1 truncate text-xs">
                                {truncateEmail(
                                  member.email ?? member.user?.email,
                                )}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions className="">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        data-testid={`member-group-add-member-${member.id}`}
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full"
                                        onClick={() =>
                                          handleAddMemberInDialog(member.id)
                                        }
                                        disabled={addLoading || removeLoading}
                                      >
                                        <CirclePlus className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>
                                    <p>
                                      {t(
                                        "workspace-member-group:detail.members.management.add_member.tooltip",
                                      )}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </ItemActions>
                          </Item>
                          {index !== availableMembers.length - 1 && (
                            <ItemSeparator />
                          )}
                        </React.Fragment>
                      ))}
                    </ItemGroup>
                  ) : (
                    <Empty className="gap-2 p-4">
                      <EmptyTitle>
                        {emptyStateType === "no_search_results"
                          ? t(
                              "workspace-member-group:detail.members.management.all_members.empty_state.no_search_results.title",
                            )
                          : t(
                              "workspace-member-group:detail.members.management.all_members.empty_state.title",
                            )}
                      </EmptyTitle>
                      <EmptyDescription>
                        {emptyStateType === "no_search_results"
                          ? t(
                              "workspace-member-group:detail.members.management.all_members.empty_state.no_search_results.description",
                            )
                          : t(
                              "workspace-member-group:detail.members.management.all_members.empty_state.description",
                            )}
                      </EmptyDescription>
                    </Empty>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* 右侧：已添加的成员 */}
            <div className="flex rounded-md border">
              <div className="flex w-full flex-col space-y-2">
                <div className="flex flex-col gap-2 p-4">
                  <h3 className="text-sm font-medium">
                    {t(
                      "workspace-member-group:detail.members.management.added_members.title",
                    )}
                  </h3>
                </div>

                <ScrollArea
                  className={cn(
                    "md:h-[calc(70dvh-18rem)]",
                    "h-[calc(50dvh-12rem)]",
                    "px-4",
                    "w-full",
                  )}
                >
                  {addedMembers.length > 0 ? (
                    <ItemGroup>
                      {addedMembers.map((member, index) => (
                        <React.Fragment key={member.id}>
                          <Item
                            size="sm"
                            className="px-0"
                            data-testid={`member-group-added-member-${member.id}`}
                          >
                            <ItemMedia>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {member.name?.charAt(0)?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                            </ItemMedia>
                            <ItemContent className="max-w-[calc(100%-6rem)] gap-0.5">
                              <ItemTitle className="line-clamp-1 truncate text-sm">
                                {member.name}
                              </ItemTitle>
                              <ItemDescription className="line-clamp-1 truncate text-xs">
                                {truncateEmail(
                                  member.email ?? member.user?.email,
                                )}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        data-testid={`member-group-remove-member-${member.id}`}
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full"
                                        onClick={() =>
                                          handleRemoveMemberClick(member.id)
                                        }
                                        disabled={addLoading || removeLoading}
                                      >
                                        <CircleMinus className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>
                                    <p>
                                      {t(
                                        "workspace-member-group:detail.members.management.delete_member.tooltip",
                                      )}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </ItemActions>
                          </Item>
                          {index !== addedMembers.length - 1 && (
                            <ItemSeparator />
                          )}
                        </React.Fragment>
                      ))}
                    </ItemGroup>
                  ) : (
                    <Empty className="gap-2 p-4">
                      <EmptyTitle>
                        {t(
                          "workspace-member-group:detail.members.management.added_members.empty_state.title",
                        )}
                      </EmptyTitle>
                      <EmptyDescription>
                        {t(
                          "workspace-member-group:detail.members.management.added_members.empty_state.description",
                        )}
                      </EmptyDescription>
                    </Empty>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" size="sm">
                  {t("action.cancel")}
                </Button>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
