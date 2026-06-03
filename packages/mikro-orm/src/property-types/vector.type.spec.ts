import { VectorType as BaseVectorType } from "pgvector/mikro-orm";

import { VectorType } from "./vector.type";

describe("VectorType", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should pass configured dimensions to the base vector type", () => {
    const getColumnType = jest
      .spyOn(BaseVectorType.prototype, "getColumnType")
      .mockReturnValue("vector(1536)");
    const platform = {} as never;

    expect(
      new VectorType(1536).getColumnType(
        {
          fieldNames: ["embedding"],
        } as never,
        platform,
      ),
    ).toBe("vector(1536)");

    expect(getColumnType).toHaveBeenCalledWith(
      {
        dimensions: 1536,
        fieldNames: ["embedding"],
      },
      platform,
    );
  });

  it("should allow property dimensions to be used when no dimensions are configured", () => {
    const getColumnType = jest
      .spyOn(BaseVectorType.prototype, "getColumnType")
      .mockReturnValue("vector(768)");

    expect(
      new VectorType().getColumnType(
        {
          dimensions: 768,
        } as never,
        {} as never,
      ),
    ).toBe("vector(768)");

    expect(getColumnType).toHaveBeenCalledWith(
      {
        dimensions: 768,
      },
      {},
    );
  });
});
