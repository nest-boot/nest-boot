import { RequestContext } from "@nest-boot/request-context";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import type { Mock, MockedFunction } from "vitest";

import { CURRENT_API_KEY, CURRENT_WORKSPACE_MEMBER } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { BaseUser } from "./entities/user.entity.js";
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  ROUTE_ARGS_METADATA,
  USER_CAN_METADATA,
  USER_PERMISSION_ABILITY,
  USER_PERMISSION_ABILITY_PROMISE,
  WORKSPACE_CAN_METADATA,
} from "./permission.constants.js";
import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";
import type { BuildAbilityCallback } from "./types/build-ability-callback.type.js";
import type { PermissionAbility } from "./types/permission-ability.type.js";
import type { RouteArgumentMetadata } from "./types/route-argument-metadata.type.js";
import { getUserAbility } from "./utils/get-user-ability.util.js";

class Subject {}
class User {}
class Workspace {}
class Controller {}
class UserOwner {}
class WorkspaceOwner {}

class PermissionAuthGuard extends AuthGuard {
  protected override isAuthenticated(): boolean {
    return true;
  }
}

interface PermissionTestRequest extends Request {
  files?: unknown;
  rawBody?: Buffer;
  session?: unknown;
  upload?: unknown;
}

describe("AuthGuard permissions", () => {
  afterEach(() => {
    Reflect.deleteMetadata(ROUTE_ARGS_METADATA, Controller, "handler");
  });

  it("allows requests without permission metadata", async () => {
    const { guard, reflector, buildAbility } = await createGuard();
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);

    expect(buildAbility).not.toHaveBeenCalled();
  });

  it("prepares both abilities for authenticated requests without permission metadata", async () => {
    const ability = {
      can: vi.fn(() => true),
    } as unknown as PermissionAbility;
    const { guard, reflector, buildUserAbility, buildWorkspaceAbility } =
      await createGuard(ability);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildUserAbility).toHaveBeenCalledOnce();
    expect(buildWorkspaceAbility).toHaveBeenCalledOnce();
  });

  it("throws when permission metadata exists but no ability is available", async () => {
    const { guard, reflector, buildAbility } = await createGuard();
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    expect(buildAbility).toHaveBeenCalledTimes(1);
  });

  it("builds, caches, and checks ability against configured permission metadata", async () => {
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req, res } = await createGuard(
      ability as unknown as PermissionAbility,
    );

    setCanMetadata(reflector, {
      scope: "user",
      action: "publish",
      subject: Subject,
    });

    const context = createContext(req, res);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(BaseUser, { permissions: ["subject:publish"] });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      await expect(
        RequestContext.get(USER_PERMISSION_ABILITY_PROMISE),
      ).resolves.toBe(ability);
      expect(RequestContext.get(USER_PERMISSION_ABILITY)).toBe(ability);
      expect(getUserAbility()).toBe(ability);
    });

    expect(buildAbility).toHaveBeenCalledWith(context, ["subject:publish"]);
    expect(canMock).toHaveBeenCalledWith("publish", Subject);
  });

  it("uses the workspace ability for workspace metadata", async () => {
    const ability = {
      can: vi.fn(() => true),
    } as unknown as PermissionAbility;
    const { guard, reflector, buildUserAbility, buildWorkspaceAbility } =
      await createGuard(ability);

    setCanMetadata(reflector, {
      action: "read",
      scope: "workspace",
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildWorkspaceAbility).toHaveBeenCalledOnce();
    expect(buildWorkspaceAbility).toHaveBeenCalledWith(expect.anything(), []);
    expect(buildUserAbility).toHaveBeenCalledOnce();
    expect(buildUserAbility).toHaveBeenCalledWith(expect.anything(), []);
  });

  it("resolves configured role and direct permissions before buildAbility", async () => {
    const roles = {
      auditor: ["project:read"],
      owner: ["project:create"],
    };
    const ability = {
      can: vi.fn(() => true),
    } as unknown as PermissionAbility;
    const { guard, reflector, buildWorkspaceAbility } = await createGuard(
      ability,
      {},
      { workspace: roles },
    );

    setCanMetadata(reflector, {
      action: "read",
      scope: "workspace",
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(CURRENT_WORKSPACE_MEMBER, {
        permissions: ["project:share", "project:create"],
        roles: ["owner", "auditor"],
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildWorkspaceAbility).toHaveBeenCalledWith(expect.anything(), [
      "project:create",
      "project:read",
      "project:share",
    ]);
  });

  it("passes GraphQL execution context to buildAbility", async () => {
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req, res } = await createGuard(
      ability as unknown as PermissionAbility,
    );
    const gqlContext = { req, res };

    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: Subject,
    });
    const context = createContext(
      undefined,
      undefined,
      [undefined, {}, gqlContext, {}],
      "graphql",
    );

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        await expect(guard.canActivate(context)).resolves.toBe(true);
      },
    );

    expect(buildAbility).toHaveBeenCalledWith(context, []);
  });

  it("uses cached ability before building a new one", async () => {
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility } = await createGuard();

    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, ability);

      return expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildAbility).not.toHaveBeenCalled();
    expect(canMock).toHaveBeenCalledWith("read", Subject);
  });

  it("checks ability against subject resolved from self and decorated method args", async () => {
    const subjectInstance = new Subject();
    const input = { id: 123 };
    const handlerThis = {
      workspaceMemberService: {
        findOne: vi.fn((_id: number) => Promise.resolve(subjectInstance)),
      },
    };
    const subjectFactory = vi.fn(
      (self: typeof handlerThis, params: { input: typeof input }) =>
        self.workspaceMemberService.findOne(params.input.id),
    );
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, moduleRef } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      "3:0": {
        index: 0,
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(
            { headers: {}, body: { input } } as unknown as Request,
            {} as Response,
            [],
          ),
        ),
      ).resolves.toBe(true);
    });

    expect(moduleRef.resolve).toHaveBeenCalledWith(
      Controller,
      expect.any(Object),
      { strict: false },
    );
    expect(subjectFactory.mock.contexts[0]).toBeUndefined();
    expect(subjectFactory).toHaveBeenCalledWith(handlerThis, { input });
    expect(handlerThis.workspaceMemberService.findOne).toHaveBeenCalledWith(
      123,
    );
    expect(canMock).toHaveBeenCalledWith("read", subjectInstance);
  });

  it("passes GraphQL resolver arguments in decorated parameter order", async () => {
    const input = { title: "New title" };
    const subjectInstance = new Subject();
    const handlerThis = {
      postService: {
        findOneOrFail: vi.fn(
          (_id: string, _input: typeof input) => subjectInstance,
        ),
      },
    };
    const subjectFactory = vi.fn(
      (self: typeof handlerThis, id: string, params: typeof input) =>
        self.postService.findOneOrFail(id, params),
    );
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, req, res } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      "3:0": {
        index: 0,
        data: "id",
      },
      "3:1": {
        index: 1,
        data: "input",
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        await expect(
          guard.canActivate(
            createContext(
              undefined,
              undefined,
              [undefined, { input, id: "post-1" }, { req, res }, {}],
              "graphql",
            ),
          ),
        ).resolves.toBe(true);
      },
    );

    expect(subjectFactory).toHaveBeenCalledWith(handlerThis, "post-1", input);
    expect(handlerThis.postService.findOneOrFail).toHaveBeenCalledWith(
      "post-1",
      input,
    );
  });

  it("passes every GraphQL route argument source to subject factories", async () => {
    const root = { root: true };
    const info = { fieldName: "post" };
    const subjectInstance = new Subject();
    const handlerThis = {};
    const subjectFactory = vi.fn(() => subjectInstance);
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, req } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      "0:0": {
        index: 0,
      },
      "3:1": {
        index: 1,
        data: "id",
      },
      "1:2": {
        index: 2,
        data: "viewer",
      },
      "2:3": {
        index: 3,
      },
      "99:4": {
        index: 4,
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        await expect(
          guard.canActivate(
            createContext(
              undefined,
              undefined,
              [root, { id: "post-1" }, { req, viewer: "user-1" }, info],
              "graphql",
            ),
          ),
        ).resolves.toBe(true);
      },
    );

    expect(subjectFactory).toHaveBeenCalledWith(
      handlerThis,
      root,
      "post-1",
      "user-1",
      info,
      undefined,
    );
    expect(canMock).toHaveBeenCalledWith("read", subjectInstance);
  });

  it("passes HTTP controller arguments in decorated parameter order", async () => {
    const input = { title: "New title" };
    const subjectInstance = new Subject();
    const handlerThis = {
      postService: {
        findOneOrFail: vi.fn(
          (_id: string, _input: typeof input) => subjectInstance,
        ),
      },
    };
    const subjectFactory = vi.fn(
      (self: typeof handlerThis, id: string, params: typeof input) =>
        self.postService.findOneOrFail(id, params),
    );
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      "5:0": {
        index: 0,
        data: "id",
      },
      "3:1": {
        index: 1,
        data: "input",
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(
            {
              headers: {},
              params: { id: "post-1" },
              body: { input },
            } as unknown as Request,
            {} as Response,
            [],
          ),
        ),
      ).resolves.toBe(true);
    });

    expect(subjectFactory).toHaveBeenCalledWith(handlerThis, "post-1", input);
    expect(handlerThis.postService.findOneOrFail).toHaveBeenCalledWith(
      "post-1",
      input,
    );
  });

  it("passes every HTTP route argument source to subject factories", async () => {
    const req = {
      body: { input: { title: "Draft" } },
      files: ["first-file"],
      headers: { "x-user-id": "user-1" },
      hosts: { account: "acme" },
      ip: "127.0.0.1",
      params: { id: "post-1" },
      query: { preview: "true" },
      rawBody: Buffer.from("raw"),
      session: { id: "session-1" },
      upload: { filename: "avatar.png" },
    } as unknown as PermissionTestRequest;
    const res = {
      locals: {},
    } as Response;
    const next = vi.fn();
    const subjectInstance = new Subject();
    const handlerThis = {};
    const subjectFactory = vi.fn(() => subjectInstance);
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      "0:0": {
        index: 0,
      },
      "1:1": {
        index: 1,
      },
      "2:2": {
        index: 2,
      },
      "3:3": {
        index: 3,
      },
      "12:4": {
        index: 4,
      },
      "5:5": {
        index: 5,
        data: "id",
      },
      "10:6": {
        index: 6,
        data: "account",
      },
      "4:7": {
        index: 7,
        data: "preview",
      },
      "6:8": {
        index: 8,
        data: "X-USER-ID",
      },
      "7:9": {
        index: 9,
      },
      "8:10": {
        index: 10,
        data: "upload",
      },
      "8:11": {
        index: 11,
      },
      "9:12": {
        index: 12,
      },
      "11:13": {
        index: 13,
      },
      "99:14": {
        index: 14,
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(req, res, [undefined, undefined, next]),
        ),
      ).resolves.toBe(true);
    });

    expect(subjectFactory).toHaveBeenCalledWith(
      handlerThis,
      req,
      res,
      next,
      req.body,
      req.rawBody,
      "post-1",
      "acme",
      "true",
      "user-1",
      req.session,
      req.upload,
      undefined,
      req.files,
      req.ip,
      undefined,
    );
    expect(canMock).toHaveBeenCalledWith("read", subjectInstance);
  });

  it("passes custom HTTP controller arguments to subject factories", async () => {
    const workspace = { id: "workspace-1" };
    const subjectInstance = new Subject();
    const customFactory = vi.fn((_data: unknown, context: ExecutionContext) =>
      context.switchToHttp().getRequest<Request>().headers["x-workspace-id"] ===
      workspace.id
        ? workspace
        : null,
    );
    const handlerThis = {
      workspaceService: {
        findSubject: vi.fn(
          (_customWorkspace: typeof workspace, _id: string) => subjectInstance,
        ),
      },
    };
    const subjectFactory = vi.fn(
      (
        self: typeof handlerThis,
        currentWorkspace: typeof workspace,
        id: string,
      ) => self.workspaceService.findSubject(currentWorkspace, id),
    );
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      [`workspace${CUSTOM_ROUTE_ARGS_METADATA}:0`]: {
        index: 0,
        data: "workspace",
        factory: customFactory,
      },
      "5:1": {
        index: 1,
        data: "id",
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(
            {
              headers: { "x-workspace-id": workspace.id },
              params: { id: "post-1" },
            } as unknown as Request,
            {} as Response,
            [],
          ),
        ),
      ).resolves.toBe(true);
    });

    expect(customFactory).toHaveBeenCalledWith("workspace", expect.any(Object));
    expect(subjectFactory).toHaveBeenCalledWith(
      handlerThis,
      workspace,
      "post-1",
    );
    expect(handlerThis.workspaceService.findSubject).toHaveBeenCalledWith(
      workspace,
      "post-1",
    );
    expect(canMock).toHaveBeenCalledWith("read", subjectInstance);
  });

  it("awaits async custom controller arguments before invoking subject factories", async () => {
    const workspace = { id: "workspace-1" };
    const subjectInstance = new Subject();
    const customFactory = vi.fn(() => Promise.resolve(workspace));
    const handlerThis = {
      workspaceService: {
        findSubject: vi.fn(
          (_customWorkspace: typeof workspace, _id: string) => subjectInstance,
        ),
      },
    };
    const subjectFactory = vi.fn(
      (
        self: typeof handlerThis,
        currentWorkspace: typeof workspace,
        id: string,
      ) => self.workspaceService.findSubject(currentWorkspace, id),
    );
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = await createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

    setRouteArgsMetadata({
      [`workspace${CUSTOM_ROUTE_ARGS_METADATA}:0`]: {
        index: 0,
        data: "workspace",
        factory: customFactory,
      },
      "5:1": {
        index: 1,
        data: "id",
      },
    });
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(
            {
              headers: {},
              params: { id: "post-1" },
            } as unknown as Request,
            {} as Response,
            [],
          ),
        ),
      ).resolves.toBe(true);
    });

    expect(subjectFactory).toHaveBeenCalledWith(
      handlerThis,
      workspace,
      "post-1",
    );
    expect(handlerThis.workspaceService.findSubject).toHaveBeenCalledWith(
      workspace,
      "post-1",
    );
  });

  it("shares a pending ability build across concurrent checks", async () => {
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility } = await createGuard();
    let resolveAbility!: (ability: PermissionAbility) => void;
    const abilityPromise = new Promise<PermissionAbility>((resolve) => {
      resolveAbility = resolve;
    });

    buildAbility.mockImplementation(() => abilityPromise);
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: Subject,
    });

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        const first = guard.canActivate(createContext());
        const second = guard.canActivate(createContext());

        await Promise.resolve();

        expect(buildAbility).toHaveBeenCalledTimes(1);

        resolveAbility(ability as unknown as PermissionAbility);

        await expect(Promise.all([first, second])).resolves.toEqual([
          true,
          true,
        ]);
      },
    );

    expect(canMock).toHaveBeenCalledTimes(2);
  });

  it("passes no subject factory args when route metadata is missing", async () => {
    const subjectInstance = new Subject();
    const handlerThis = {};
    const subjectFactory = vi.fn(() => subjectInstance);
    const canMock = vi.fn(() => true);
    const { guard, reflector, moduleRef } = await createGuard(
      {
        can: canMock,
      } as unknown as PermissionAbility,
      handlerThis,
    );

    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "rpc" }), async () => {
      await expect(
        guard.canActivate(createContext(undefined, undefined, [], "rpc")),
      ).resolves.toBe(true);
    });

    expect(moduleRef.resolve).toHaveBeenCalledWith(Controller, undefined, {
      strict: false,
    });
    expect(subjectFactory).toHaveBeenCalledWith(handlerThis);
  });

  it("falls back to prototype lookup and null when handler names are unavailable", async () => {
    const subjectInstance = new Subject();
    const handlerThis = {};
    const subjectFactory = vi.fn(() => subjectInstance);
    const canMock = vi.fn(() => true);
    const { guard, reflector } = await createGuard(
      {
        can: canMock,
      } as unknown as PermissionAbility,
      handlerThis,
    );
    const matchedHandler = createUnnamedHandler();
    const unmatchedHandler = createUnnamedHandler();

    Object.defineProperty(Controller.prototype, "matched", {
      configurable: true,
      value: matchedHandler,
    });
    Reflect.defineMetadata(
      ROUTE_ARGS_METADATA,
      {
        "3:0": {
          index: 0,
          data: 1,
        },
      },
      Controller,
      "matched",
    );
    setCanMetadata(reflector, {
      scope: "user",
      action: "read",
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      const matchedContext = createContext(
        {
          body: { input: true },
          headers: {},
        } as unknown as Request,
        {} as Response,
      ) as ExecutionContext & { getHandler: Mock };
      matchedContext.getHandler = vi.fn(() => matchedHandler);

      await expect(guard.canActivate(matchedContext)).resolves.toBe(true);

      const unmatchedContext = createContext(
        {
          body: "not-an-object",
          headers: {},
        } as unknown as Request,
        {} as Response,
      ) as ExecutionContext & { getHandler: Mock };
      unmatchedContext.getHandler = vi.fn(() => unmatchedHandler);

      await expect(guard.canActivate(unmatchedContext)).resolves.toBe(true);
    });

    expect(subjectFactory).toHaveBeenNthCalledWith(1, handlerThis, {
      input: true,
    });
    expect(subjectFactory).toHaveBeenNthCalledWith(2, handlerThis);

    Reflect.deleteMetadata(ROUTE_ARGS_METADATA, Controller, "matched");
    delete (Controller.prototype as Record<string, unknown>).matched;
  });

  it("returns false when ability denies the permission", async () => {
    const canMock = vi.fn(() => false);
    const { guard, reflector } = await createGuard({
      can: canMock,
    } as unknown as PermissionAbility);

    setCanMetadata(reflector, {
      scope: "user",
      action: "delete",
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });
  });

  it("requires both permissions when both metadata types are declared", async () => {
    const canMock = vi.fn((action: string) => action === "read");
    const { guard, reflector, buildUserAbility, buildWorkspaceAbility } =
      await createGuard({ can: canMock } as unknown as PermissionAbility);

    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === USER_CAN_METADATA) {
        return [{ action: "read", subject: User }];
      }
      if (key === WORKSPACE_CAN_METADATA) {
        return [{ action: "update", subject: Workspace }];
      }
      return undefined;
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });

    expect(buildUserAbility).toHaveBeenCalledOnce();
    expect(buildWorkspaceAbility).toHaveBeenCalledOnce();
    expect(canMock).toHaveBeenNthCalledWith(1, "read", User);
    expect(canMock).toHaveBeenNthCalledWith(2, "update", Workspace);
  });

  it("requires all repeated user permission declarations", async () => {
    const canMock = vi.fn((action: string) => action === "read");
    const { guard, reflector } = await createGuard({
      can: canMock,
    } as unknown as PermissionAbility);

    reflector.getAllAndOverride.mockImplementation((key) =>
      key === USER_CAN_METADATA
        ? [
            { action: "read", subject: User },
            { action: "update", subject: User },
          ]
        : undefined,
    );

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });

    expect(canMock).toHaveBeenNthCalledWith(1, "read", User);
    expect(canMock).toHaveBeenNthCalledWith(2, "update", User);
  });

  it("requires all repeated workspace permission declarations", async () => {
    const canMock = vi.fn((action: string) => action === "read");
    const { guard, reflector } = await createGuard({
      can: canMock,
    } as unknown as PermissionAbility);

    reflector.getAllAndOverride.mockImplementation((key) =>
      key === WORKSPACE_CAN_METADATA
        ? [
            { action: "read", subject: Workspace },
            { action: "update", subject: Workspace },
          ]
        : undefined,
    );

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });

    expect(canMock).toHaveBeenNthCalledWith(1, "read", Workspace);
    expect(canMock).toHaveBeenNthCalledWith(2, "update", Workspace);
  });

  it("restricts API-key requests to the key permissions", async () => {
    const { guard, reflector } = await createGuard({
      can: vi.fn(() => true),
    } as unknown as PermissionAbility);

    setCanMetadata(reflector, {
      scope: "user",
      action: "get",
      subject: User,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(CURRENT_API_KEY, {
        owner: new UserOwner(),
        permissions: ["user:get"],
      });
      RequestContext.set(BaseUser, {
        permissions: ["user:get"],
      });

      await expect(guard.canActivate(createContext())).resolves.toBe(true);

      setCanMetadata(reflector, {
        scope: "user",
        action: "update",
        subject: User,
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });
  });

  it("rejects missing API-key permissions", async () => {
    const { guard, reflector } = await createGuard({
      can: vi.fn(() => true),
    } as unknown as PermissionAbility);

    setCanMetadata(reflector, {
      scope: "user",
      action: "delete",
      subject: User,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(CURRENT_API_KEY, {
        owner: new UserOwner(),
        permissions: null,
      });
      RequestContext.set(BaseUser, {
        permissions: ["user:delete"],
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);

      RequestContext.set(CURRENT_API_KEY, {
        owner: new UserOwner(),
        permissions: [],
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });
  });

  it("authorizes workspace keys directly from key permissions", async () => {
    const { guard, reflector, buildAbility } = await createGuard();
    setCanMetadata(reflector, {
      action: "update",
      scope: "workspace",
      subject: Workspace,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(CURRENT_API_KEY, {
        owner: new WorkspaceOwner(),
        permissions: ["workspace:update"],
      });

      await expect(guard.canActivate(createContext())).resolves.toBe(true);
      setCanMetadata(reflector, {
        action: "update",
        scope: "user",
        subject: Workspace,
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });

    expect(buildAbility).toHaveBeenCalledOnce();
  });

  it("intersects user-key permissions with workspace-member permissions", async () => {
    const canMock = vi.fn(() => true);
    const { guard, reflector } = await createGuard({
      can: canMock,
    } as unknown as PermissionAbility);
    setCanMetadata(reflector, {
      action: "update",
      scope: "workspace",
      subject: Workspace,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(CURRENT_API_KEY, {
        owner: new UserOwner(),
        permissions: ["workspace:update"],
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);

      RequestContext.set(CURRENT_WORKSPACE_MEMBER, { id: "member-1" });
      await expect(guard.canActivate(createContext())).resolves.toBe(true);

      RequestContext.set(CURRENT_API_KEY, {
        owner: new UserOwner(),
        permissions: ["workspace:delete"],
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });

    expect(canMock).toHaveBeenCalledWith("update", Workspace);
  });

  it("intersects user-owned API-key permissions with the user ability", async () => {
    const { guard, reflector } = await createGuard({
      can: vi.fn(
        () =>
          RequestContext.get(BaseUser)?.permissions.includes("user:get") ??
          false,
      ),
    } as unknown as PermissionAbility);
    setCanMetadata(reflector, {
      action: "get",
      scope: "user",
      subject: User,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      RequestContext.set(CURRENT_API_KEY, {
        owner: new UserOwner(),
        permissions: ["user:get"],
      });
      RequestContext.set(BaseUser, { permissions: [] });
      await expect(guard.canActivate(createContext())).resolves.toBe(false);

      RequestContext.set(BaseUser, {
        permissions: ["user:get"],
      });
      await expect(guard.canActivate(createContext())).resolves.toBe(true);
    });
  });
});

async function createGuard(
  ability: PermissionAbility | null = null,
  handlerThis: unknown = {},
  roles: {
    user?: AuthModuleRoles;
    workspace?: AuthModuleRoles;
  } = {},
) {
  const reflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as Reflector & {
    getAllAndOverride: Mock;
  };
  const buildUserAbility: MockedFunction<BuildAbilityCallback> = vi.fn(
    (_ctx) => ability,
  );
  const buildWorkspaceAbility: MockedFunction<BuildAbilityCallback> = vi.fn(
    (_ctx) => ability,
  );
  const moduleRefMock = {
    resolve: vi.fn(() => Promise.resolve(handlerThis)),
  } as unknown as ModuleRef & { resolve: Mock };
  const req = {
    headers: {},
  } as Request;
  const res = {} as Response;
  const testingModule = await Test.createTestingModule({
    providers: [
      PermissionAuthGuard,
      {
        provide: Reflector,
        useValue: reflector,
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: {
          user: {
            buildAbility: buildUserAbility,
            roles: roles.user,
          },
          entities: {
            user: UserOwner,
            workspace: WorkspaceOwner,
          },
          workspace: {
            buildAbility: buildWorkspaceAbility,
            roles: roles.workspace,
          },
        },
      },
      {
        provide: ModuleRef,
        useValue: moduleRefMock,
      },
    ],
  }).compile();

  return {
    guard: testingModule.get(PermissionAuthGuard),
    reflector,
    buildAbility: buildUserAbility,
    buildUserAbility,
    buildWorkspaceAbility,
    moduleRef: moduleRefMock,
    req,
    res,
  };
}

function createContext(
  req?: Request,
  res?: Response,
  args: unknown[] = [],
  type = "http",
) {
  const resolvedReq =
    arguments.length >= 1 ? req : ({ headers: {} } as Request);
  const resolvedRes = arguments.length >= 2 ? res : ({} as Response);

  return {
    getType: vi.fn(() => type),
    switchToHttp: () => ({
      getRequest: () => resolvedReq,
      getResponse: () => resolvedRes,
      getNext: () => args[2],
    }),
    getArgs: vi.fn(() => args),
    getHandler: vi.fn(
      () =>
        function handler() {
          return undefined;
        },
    ),
    getClass: vi.fn(() => Controller),
  } as unknown as ExecutionContext;
}

function setRouteArgsMetadata(metadata: RouteArgumentMetadata) {
  Reflect.defineMetadata(ROUTE_ARGS_METADATA, metadata, Controller, "handler");
}

function createUnnamedHandler() {
  return function () {
    return undefined;
  };
}

function setCanMetadata(
  reflector: Reflector & { getAllAndOverride: Mock },
  metadata: {
    action: string;
    scope: "user" | "workspace";
    subject: unknown;
  },
): void {
  const { scope, ...scopedMetadata } = metadata;
  const metadataKey =
    scope === "user" ? USER_CAN_METADATA : WORKSPACE_CAN_METADATA;

  reflector.getAllAndOverride.mockImplementation((key) =>
    key === metadataKey ? [scopedMetadata] : undefined,
  );
}
