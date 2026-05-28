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

describe("PermissionGuard", () => {
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

  it("checks ability against subject resolved from self and args", async () => {
    const subjectInstance = new Subject();
    const handlerArgs = [{ input: { id: 123 } }];
    const handlerThis = {
      workspaceMemberService: {
        findOne: jest.fn((_id: number) => Promise.resolve(subjectInstance)),
      },
    };
    const subjectFactory = jest.fn(
      (self: typeof handlerThis, params: (typeof handlerArgs)[number]) =>
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

    reflector.getAllAndOverride.mockReturnValue({
      action: PermissionAction.UPDATE,
      subject: subjectFactory,
    });

    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      await expect(
        guard.canActivate(
          createContext(
            { headers: {} } as Request,
            {} as Response,
            handlerArgs,
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
    expect(subjectFactory).toHaveBeenCalledWith(handlerThis, ...handlerArgs);
    expect(handlerThis.workspaceMemberService.findOne).toHaveBeenCalledWith(
      123,
    );
    expect(canMock).toHaveBeenCalledWith(
      PermissionAction.UPDATE,
      subjectInstance,
    );
  });

  it("passes GraphQL resolver arguments to subject factories", async () => {
    const subjectInstance = new Subject();
    const handlerThis = {
      postService: {
        findOneOrFail: jest.fn((_params: { id: string }) =>
          Promise.resolve(subjectInstance),
        ),
      },
    };
    const subjectFactory = jest.fn((self: typeof handlerThis, id: string) =>
      self.postService.findOneOrFail({ id }),
    );
    const canMock = jest.fn(() => true);
    const ability = {
      can: canMock,
    };
    const { guard, reflector, req, res } = createGuard(
      ability as unknown as PermissionAbility,
      handlerThis,
    );

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
              [undefined, { id: "post-1" }, { req, res }, {}],
              "graphql",
            ),
          ),
        ).resolves.toBe(true);
      },
    );

    expect(subjectFactory).toHaveBeenCalledWith(handlerThis, "post-1");
    expect(handlerThis.postService.findOneOrFail).toHaveBeenCalledWith({
      id: "post-1",
    });
    expect(canMock).toHaveBeenCalledWith(
      PermissionAction.UPDATE,
      subjectInstance,
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
