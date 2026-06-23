import { RequestContext } from "@nest-boot/request-context";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import type { Mock, MockedFunction } from "vitest";

import { PermissionAction } from "./enums/permission-action.enum.js";
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  PERMISSION_ABILITY,
  PERMISSION_ABILITY_PROMISE,
  ROUTE_ARGS_METADATA,
} from "./permission.constants.js";
import { PermissionGuard } from "./permission.guard.js";
import { MODULE_OPTIONS_TOKEN } from "./permission.module-definition.js";
import type { BuildAbilityCallback } from "./types/build-ability-callback.type.js";
import type { PermissionAbility } from "./types/permission-ability.type.js";
import type { RouteArgumentMetadata } from "./types/route-argument-metadata.type.js";
import { getPermissionAbility } from "./utils/get-permission-ability.util.js";

class Subject {}
class Controller {}

interface PermissionTestRequest extends Request {
  files?: unknown;
  rawBody?: Buffer;
  session?: unknown;
  upload?: unknown;
}

describe("PermissionGuard", () => {
  afterEach(() => {
    Reflect.deleteMetadata(ROUTE_ARGS_METADATA, Controller, "handler");
  });

  it("allows requests without permission metadata", async () => {
    const { guard, reflector, buildAbility } = await createGuard();
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);

    expect(buildAbility).not.toHaveBeenCalled();
  });

  it("throws when permission metadata exists but no ability is available", async () => {
    const { guard, reflector, buildAbility } = await createGuard();
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
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

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
      subject: Subject,
    });

    const context = createContext(req, res);

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      await expect(
        RequestContext.get(PERMISSION_ABILITY_PROMISE),
      ).resolves.toBe(ability);
      expect(RequestContext.get(PERMISSION_ABILITY)).toBe(ability);
      expect(getPermissionAbility()).toBe(ability);
    });

    expect(buildAbility).toHaveBeenCalledWith(context);
    expect(canMock).toHaveBeenCalledWith(PermissionAction.UPDATE, Subject);
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

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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

    expect(buildAbility).toHaveBeenCalledWith(context);
  });

  it("uses cached ability before building a new one", async () => {
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility } = await createGuard();

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(PERMISSION_ABILITY, ability);

      return expect(guard.canActivate(createContext())).resolves.toBe(true);
    });

    expect(buildAbility).not.toHaveBeenCalled();
    expect(canMock).toHaveBeenCalledWith(PermissionAction.UPDATE, Subject);
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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
    expect(canMock).toHaveBeenCalledWith(
      PermissionAction.UPDATE,
      subjectInstance,
    );
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
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
    expect(canMock).toHaveBeenCalledWith(
      PermissionAction.READ,
      subjectInstance,
    );
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
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
    expect(canMock).toHaveBeenCalledWith(
      PermissionAction.READ,
      subjectInstance,
    );
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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
    expect(canMock).toHaveBeenCalledWith(
      PermissionAction.UPDATE,
      subjectInstance,
    );
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
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

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
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
    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
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

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.DELETE,
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext())).resolves.toBe(false);
    });
  });
});

async function createGuard(
  ability: PermissionAbility | null = null,
  handlerThis: unknown = {},
) {
  const reflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as Reflector & {
    getAllAndOverride: Mock;
  };
  const buildAbility: MockedFunction<BuildAbilityCallback> = vi.fn(
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
      PermissionGuard,
      {
        provide: Reflector,
        useValue: reflector,
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: {
          buildAbility,
        },
      },
      {
        provide: ModuleRef,
        useValue: moduleRefMock,
      },
    ],
  }).compile();

  return {
    guard: testingModule.get(PermissionGuard),
    reflector,
    buildAbility,
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
