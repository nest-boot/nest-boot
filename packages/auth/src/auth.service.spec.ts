import { Test } from "@nestjs/testing";

import { AUTH_TOKEN } from "./auth.constants";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("should expose the better-auth api", async () => {
    const api = {
      getSession: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AUTH_TOKEN,
          useValue: {
            api,
          },
        },
      ],
    }).compile();
    const service = moduleRef.get(AuthService);

    expect(service.api).toBe(api);
  });
});
