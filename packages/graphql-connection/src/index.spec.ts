import * as publicApi from "./index.js";

describe("public exports", () => {
  it("exports runtime connection APIs", () => {
    expect(publicApi.ConnectionBuilder).toBeDefined();
    expect(publicApi.ConnectionManager).toBeDefined();
    expect(publicApi.GraphQLConnectionModule).toBeDefined();
    expect(publicApi.OrderDirection).toBeDefined();
    expect(publicApi.PageInfo).toBeDefined();
    expect(publicApi.createFilter).toBeDefined();
  });
});
