import { BaseAccount } from "./account.entity";
import { BaseSession } from "./session.entity";
import { BaseUser } from "./user.entity";
import { BaseVerification } from "./verification.entity";

class TestAccount extends BaseAccount {}
class TestVerification extends BaseVerification {}

describe("auth entities", () => {
  it("should initialize generated ids and timestamps", () => {
    const account = new TestAccount();
    const session = new BaseSession();
    const user = new BaseUser();
    const verification = new TestVerification();

    for (const entity of [account, session, user, verification]) {
      expect(entity.id).toEqual(expect.any(String));
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("should emit decorator metadata when Opt exists at runtime", () => {
    jest.isolateModules(() => {
      jest.doMock("@mikro-orm/core", () => {
        const actual = jest.requireActual("@mikro-orm/core");

        return {
          ...actual,
          Opt: function Opt() {
            return undefined;
          },
        };
      });

      expect(
        jest.requireActual<typeof import("./account.entity")>(
          "./account.entity",
        ).BaseAccount,
      ).toBeDefined();
      expect(
        jest.requireActual<typeof import("./session.entity")>(
          "./session.entity",
        ).BaseSession,
      ).toBeDefined();
      expect(
        jest.requireActual<typeof import("./user.entity")>("./user.entity")
          .BaseUser,
      ).toBeDefined();
      expect(
        jest.requireActual<typeof import("./verification.entity")>(
          "./verification.entity",
        ).BaseVerification,
      ).toBeDefined();
      jest.dontMock("@mikro-orm/core");
    });
  });

  it("should pass relation and update callbacks to MikroORM decorators", () => {
    const relationTargets: unknown[] = [];
    const updateValues: unknown[] = [];
    const decorator = () => () => undefined;

    jest.isolateModules(() => {
      jest.doMock("@mikro-orm/core", () => {
        const actual = jest.requireActual("@mikro-orm/core");

        return {
          ...actual,
          Entity: decorator,
          ManyToOne: (target: () => unknown) => {
            relationTargets.push(target());
            return () => undefined;
          },
          Opt: function Opt() {
            return undefined;
          },
          PrimaryKey: decorator,
          Property: (options: { onUpdate?: () => unknown } = {}) => {
            if (options.onUpdate) {
              updateValues.push(options.onUpdate());
            }
            return () => undefined;
          },
          Unique: decorator,
        };
      });

      jest.requireActual<typeof import("./account.entity")>("./account.entity");
      jest.requireActual<typeof import("./session.entity")>("./session.entity");
      jest.requireActual<typeof import("./user.entity")>("./user.entity");
      jest.requireActual<typeof import("./verification.entity")>(
        "./verification.entity",
      );
      jest.dontMock("@mikro-orm/core");
    });

    expect(relationTargets).toEqual(["User", "User"]);
    expect(updateValues).toHaveLength(4);
    expect(updateValues.every((value) => value instanceof Date)).toBe(true);
  });
});
