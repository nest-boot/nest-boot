import { RequestContext } from "@nest-boot/request-context";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import type { Request, Response } from "express";

import { PermissionAction } from "./enums/permission-action.enum";
import type { BuildAbilityCallback } from "./interfaces/permission-module-options.interface";
import {
  PERMISSION_ABILITY,
  PERMISSION_ABILITY_PROMISE,
} from "./permission.constants";
import { PermissionGuard } from "./permission.guard";
import type { PermissionAbility } from "./types/permission-ability.type";
import { getPermissionAbility } from "./utils/get-permission-ability.util";

class Subject {}
class Controller {}
const ROUTE_ARGS_METADATA = "__routeArguments__";
const CUSTOM_ROUTE_ARGS_METADATA = "__customRouteArgs__";

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

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(guard.canActivate(createContext(req, res))).resolves.toBe(
        true,
      );

      await expect(
        RequestContext.get(PERMISSION_ABILITY_PROMISE),
      ).resolves.toBe(ability);
      expect(RequestContext.get(PERMISSION_ABILITY)).toBe(ability);
      expect(getPermissionAbility()).toBe(ability);
    });

    expect(buildAbility).toHaveBeenCalledWith({ req, res });
    expect(canMock).toHaveBeenCalledWith(PermissionAction.UPDATE, Subject);
  });

  it("builds ability from GraphQL context when HTTP request is unavailable", async () => {
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

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        await expect(
          guard.canActivate(
            createContext(
              undefined,
              undefined,
              [undefined, {}, gqlContext, {}],
              "graphql",
            ),
          ),
        ).resolves.toBe(true);
      },
    );

    expect(buildAbility).toHaveBeenCalledWith(gqlContext);
  });

  it("builds ability from GraphQL contexts that only expose req", async () => {
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req } = createGuard(
      ability as unknown as PermissionAbility,
    );
    const gqlContext = { req };

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
      subject: Subject,
    });

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        await expect(
          guard.canActivate(
            createContext(
              undefined,
              undefined,
              [undefined, {}, gqlContext, {}],
              "graphql",
            ),
          ),
        ).resolves.toBe(true);
      },
    );

    expect(buildAbility).toHaveBeenCalledWith(gqlContext);
  });

  it("prefers GraphQL request context over HTTP switch args for GraphQL handlers", async () => {
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req, res } = createGuard(
      ability as unknown as PermissionAbility,
    );
    const root = {
      headers: { authorization: "root-token" },
    } as unknown as Request;
    const gqlContext = { req, res };

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
      subject: Subject,
    });

    await RequestContext.run(
      new RequestContext({ type: "graphql" }),
      async () => {
        await expect(
          guard.canActivate(
            createContext(
              root,
              {} as Response,
              [root, {}, gqlContext, {}],
              "graphql",
            ),
          ),
        ).resolves.toBe(true);
      },
    );

    expect(buildAbility).toHaveBeenCalledWith(gqlContext);
  });

  it("does not fall back to GraphQL request context for HTTP handlers", async () => {
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, buildAbility, req, res } = createGuard(
      ability as unknown as PermissionAbility,
    );

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.READ,
      subject: Subject,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(
            undefined,
            undefined,
            [undefined, {}, { req, res }, {}],
            "http",
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    expect(buildAbility).not.toHaveBeenCalled();
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

  it("applies parameter pipes before invoking subject factories", async () => {
    const subjectInstance = new Subject();
    const parseIdPipe = {
      transform: jest.fn((value: unknown) => Number(value)),
    };
    const handlerThis = {
      postService: {
        findOneOrFail: jest.fn((_id: number) => subjectInstance),
      },
    };
    const subjectFactory = jest.fn((self: typeof handlerThis, id: number) =>
      self.postService.findOneOrFail(id),
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
        pipes: [parseIdPipe],
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
              params: { id: "42" },
            } as unknown as Request,
            {} as Response,
            [],
          ),
        ),
      ).resolves.toBe(true);
    });

    expect(parseIdPipe.transform).toHaveBeenCalledWith("42", {
      data: "id",
      metatype: undefined,
      type: "param",
    });
    expect(subjectFactory).toHaveBeenCalledWith(handlerThis, 42);
    expect(handlerThis.postService.findOneOrFail).toHaveBeenCalledWith(42);
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

function setRouteArgsMetadata(
  metadata: Record<
    string,
    {
      index: number;
      data?: string;
      factory?: (data: unknown, context: ExecutionContext) => unknown;
      pipes?: {
        transform: (value: unknown, metadata?: unknown) => unknown;
      }[];
    }
  >,
) {
  Reflect.defineMetadata(ROUTE_ARGS_METADATA, metadata, Controller, "handler");
}
