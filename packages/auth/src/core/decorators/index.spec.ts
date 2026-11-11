import { Public } from "../../common/decorators/public.decorator.js";
import * as decorators from "./index.js";

describe("auth.decorators.spec.ts", () => {
  describe("auth decorators", () => {
    it("should export public decorator helpers", () => {
      expect(decorators.Public).toBe(Public);
      expect(decorators.CurrentSession).toBeDefined();
      expect(decorators.CurrentUser).toBeDefined();
      expect(decorators.CurrentApiKey).toBeDefined();
      expect(decorators.CurrentWorkspace).toBeDefined();
      expect(decorators.CurrentMember).toBeDefined();
    });
  });
});
