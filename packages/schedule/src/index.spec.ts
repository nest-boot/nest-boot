describe("public API", () => {
  it("should export schedule module APIs", async () => {
    const api = await import("./index.js");

    expect(api.ScheduleModule).toBeDefined();
    expect(api.ScheduleRegistry).toBeDefined();
    expect(api.Schedule).toBeDefined();
    expect(api.Cron).toBeDefined();
    expect(api.Interval).toBeDefined();
  });
});
