import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("should expose the better-auth api", () => {
    const api = {
      getSession: jest.fn(),
    };
    const service = new AuthService({
      api,
    } as never);

    expect(service.api).toBe(api);
  });
});
