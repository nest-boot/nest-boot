import { RequestContext } from "@nest-boot/request-context";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import type { Request, Response } from "express";

import { PermissionAction } from "./enums/permission-action.enum";
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  PERMISSION_ABILITY,
  PERMISSION_ABILITY_PROMISE,
  ROUTE_ARGS_METADATA,
} from "./permission.constants";
import { PermissionGuard } from "./permission.guard";
import type { BuildAbilityCallback } from "./types/build-ability-callback.type";
import type { PermissionAbility } from "./types/permission-ability.type";
import type { RouteArgumentMetadata } from "./types/route-argument-metadata.type";
import { getPermissionAbility } from "./utils/get-permission-ability.util";

class Subject {}
class Controller {}

describe("PermissionGuard", () => {
  afterEach(() => {
    Reflect.deleteMetadata(ROUTE_ARGS_METADATA, Controller, "handler");
  });

  it("allows requests without permission metadata", async () => {
    const { guard, reflector, buildAbility } = createGuard();
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);

    expect(buildAbility).not.toHaveBeenCalled();
  });

  it("throws when permission metadata exists but no ability is available", async () => {
    const { guard, reflector, buildAbility } = createGuard();
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
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req, res } = createGuard(
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
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req, res } = createGuard(
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
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility } = createGuard();

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
        findOne: jest.fn((_id: number) => Promise.resolve(subjectInstance)),
      },
    };
    const subjectFactory = jest.fn(
      (self: typeof handlerThis, params: { input: typeof input }) =>
        self.workspaceMemberService.findOne(params.input.id),
    );
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, moduleRef } = createGuard(
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
        findOneOrFail: jest.fn(
          (_id: string, _input: typeof input) => subjectInstance,
        ),
      },
    };
    const subjectFactory = jest.fn(
      (self: typeof handlerThis, id: string, params: typeof input) =>
        self.postService.findOneOrFail(id, params),
    );
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, req, res } = createGuard(
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

  it("passes HTTP controller arguments in decorated parameter order", async () => {
    const input = { title: "New title" };
    const subjectInstance = new Subject();
    const handlerThis = {
      postService: {
        findOneOrFail: jest.fn(
          (_id: string, _input: typeof input) => subjectInstance,
        ),
      },
    };
    const subjectFactory = jest.fn(
      (self: typeof handlerThis, id: string, params: typeof input) =>
        self.postService.findOneOrFail(id, params),
    );
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = createGuard(
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

  it("passes custom HTTP controller arguments to subject factories", async () => {
    const workspace = { id: "workspace-1" };
    const subjectInstance = new Subject();
    const customFactory = jest.fn(
      (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<Request>().headers[
          "x-workspace-id"
        ] === workspace.id
          ? workspace
          : null,
    );
    const handlerThis = {
      workspaceService: {
        findSubject: jest.fn(
          (_customWorkspace: typeof workspace, _id: string) => subjectInstance,
        ),
      },
    };
    const subjectFactory = jest.fn(
      (
        self: typeof handlerThis,
        currentWorkspace: typeof workspace,
        id: string,
      ) => self.workspaceService.findSubject(currentWorkspace, id),
    );
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = createGuard(
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
    const customFactory = jest.fn(() => Promise.resolve(workspace));
    const handlerThis = {
      workspaceService: {
        findSubject: jest.fn(
          (_customWorkspace: typeof workspace, _id: string) => subjectInstance,
        ),
      },
    };
    const subjectFactory = jest.fn(
      (
        self: typeof handlerThis,
        currentWorkspace: typeof workspace,
        id: string,
      ) => self.workspaceService.findSubject(currentWorkspace, id),
    );
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector } = createGuard(
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
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility } = createGuard();
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

  it("returns false when ability denies the permission", async () => {
    const canMock = jest.fn(() => false);
    const { guard, reflector } = createGuard({
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

function createGuard(
  ability: PermissionAbility | null = null,
  handlerThis: unknown = {},
) {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector & {
    getAllAndOverride: jest.Mock;
  };
  const buildAbility: jest.MockedFunction<BuildAbilityCallback> = jest.fn(
    (_ctx) => ability,
  );
  const moduleRef = {
    resolve: jest.fn(() => Promise.resolve(handlerThis)),
  } as unknown as ModuleRef & { resolve: jest.Mock };
  const req = {
    headers: {},
  } as Request;
  const res = {} as Response;

  return {
    guard: new PermissionGuard(reflector, { buildAbility }, moduleRef),
    reflector,
    buildAbility,
    moduleRef,
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
    getType: jest.fn(() => type),
    switchToHttp: () => ({
      getRequest: () => resolvedReq,
      getResponse: () => resolvedRes,
      getNext: () => args[2],
    }),
    getArgs: jest.fn(() => args),
    getHandler: jest.fn(
      () =>
        function handler() {
          return undefined;
        },
    ),
    getClass: jest.fn(() => Controller),
  } as unknown as ExecutionContext;
}

function setRouteArgsMetadata(metadata: RouteArgumentMetadata) {
  Reflect.defineMetadata(ROUTE_ARGS_METADATA, metadata, Controller, "handler");
}
