import { BaseAccount } from "./account.entity.js";
import { BaseSession } from "./session.entity.js";
import { BaseUser } from "./user.entity.js";
import { BaseVerification } from "./verification.entity.js";

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

  it("should load entities in an isolated module", async () => {
    vi.resetModules();

    expect((await import("./account.entity.js")).BaseAccount).toBeDefined();
    expect((await import("./session.entity.js")).BaseSession).toBeDefined();
    expect((await import("./user.entity.js")).BaseUser).toBeDefined();
    expect(
      (await import("./verification.entity.js")).BaseVerification,
    ).toBeDefined();
  });

  it("should pass relation and update callbacks to MikroORM decorators", async () => {
    const relationTargets: unknown[] = [];
    const updateValues: unknown[] = [];
    const decorator = () => () => undefined;

    vi.resetModules();
    vi.doMock("@mikro-orm/decorators/legacy", async () => {
      const actual = await vi.importActual<
        typeof import("@mikro-orm/decorators/legacy")
      >("@mikro-orm/decorators/legacy");

      return {
        ...actual,
        Entity: decorator,
        ManyToOne: (options: { entity?: () => unknown }) => {
          relationTargets.push(options.entity?.());
          return () => undefined;
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

    await import("./account.entity.js");
    await import("./session.entity.js");
    await import("./user.entity.js");
    await import("./verification.entity.js");
    vi.doUnmock("@mikro-orm/decorators/legacy");

    expect(relationTargets).toEqual(["User", "User"]);
    expect(updateValues).toHaveLength(4);
    expect(updateValues.every((value) => value instanceof Date)).toBe(true);
  });
});
