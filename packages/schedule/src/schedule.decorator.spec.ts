import "reflect-metadata";

import { Cron, Interval, Schedule } from "./schedule.decorator.js";
import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition.js";

function getMethod(prototype: object, name: string) {
  return Object.getOwnPropertyDescriptor(prototype, name)?.value;
}

describe("schedule decorators", () => {
  class ExampleSchedules {
    @Schedule({
      type: "cron",
      value: "0 1 * * *",
      timezone: "Asia/Shanghai",
    })
    explicit() {
      return undefined;
    }

    @Cron("* * * * *", {
      attempts: 2,
      timezone: "UTC",
    })
    cron() {
      return undefined;
    }

    @Interval("5000", {
      removeOnComplete: true,
    })
    interval() {
      return undefined;
    }
  }

  it("should attach explicit schedule metadata", () => {
    expect(
      Reflect.getMetadata(
        SCHEDULE_METADATA_KEY,
        getMethod(ExampleSchedules.prototype, "explicit"),
      ),
    ).toEqual({
      type: "cron",
      value: "0 1 * * *",
      timezone: "Asia/Shanghai",
    });
  });

  it("should build cron and interval metadata with optional job options", () => {
    expect(
      Reflect.getMetadata(
        SCHEDULE_METADATA_KEY,
        getMethod(ExampleSchedules.prototype, "cron"),
      ),
    ).toEqual({
      attempts: 2,
      timezone: "UTC",
      type: "cron",
      value: "* * * * *",
    });
    expect(
      Reflect.getMetadata(
        SCHEDULE_METADATA_KEY,
        getMethod(ExampleSchedules.prototype, "interval"),
      ),
    ).toEqual({
      removeOnComplete: true,
      type: "interval",
      value: "5000",
    });
  });

  it("should default omitted decorator options to an empty object", () => {
    class Defaults {
      @Cron("0 * * * *")
      cron() {
        return undefined;
      }

      @Interval(1000)
      interval() {
        return undefined;
      }
    }

    expect(
      Reflect.getMetadata(
        SCHEDULE_METADATA_KEY,
        getMethod(Defaults.prototype, "cron"),
      ),
    ).toEqual({
      type: "cron",
      value: "0 * * * *",
    });
    expect(
      Reflect.getMetadata(
        SCHEDULE_METADATA_KEY,
        getMethod(Defaults.prototype, "interval"),
      ),
    ).toEqual({
      type: "interval",
      value: 1000,
    });
  });
});
