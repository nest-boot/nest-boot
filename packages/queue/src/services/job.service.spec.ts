import { MikroORM } from "@mikro-orm/pglite";
import { ForbiddenException } from "@nestjs/common";

import { Job } from "../entities/job.entity.js";
import { JobStatus } from "../enums/job-status.enum.js";
import { JobService } from "./job.service.js";

describe("JobService read authorization without database RLS", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({ dbName: "memory://", entities: [Job] });
    await orm.schema.create();
    await orm.em.fork().insertMany(
      Job,
      ["alice", "bob"].map((owner) => ({
        id: `reports:${owner}`,
        queueName: "reports",
        name: "report",
        data: { owner },
        status: JobStatus.COMPLETED,
        progress: 100,
        priority: 0,
      })),
    );
  }, 30000);

  afterAll(async () => {
    await orm?.close();
  });

  it.each([undefined, () => null, () => undefined])(
    "denies both query paths without an authorized scope",
    async (getJobReadFilter) => {
      const service = new JobService(orm.em.fork(), { getJobReadFilter });
      await expect(service.getJob("reports:alice")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.getJobConnection({ first: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it("evaluates the current identity for every read and scopes rows and counts", async () => {
    let owner = "alice";
    const service = new JobService(orm.em.fork(), {
      getJobReadFilter: () => Promise.resolve({ data: { owner } }),
    });
    expect((await service.getJob("reports:alice"))?.id).toBe("reports:alice");
    expect(await service.getJob("reports:bob")).toBeNull();
    const connection = await service.getJobConnection({ first: 10 });
    expect(connection.totalCount).toBe(1);
    expect(connection.edges.map(({ node }) => node.id)).toEqual([
      "reports:alice",
    ]);
    const forbiddenFilter = await service.getJobConnection({
      first: 10,
      filter: { id: "reports:bob" },
    });
    expect(forbiddenFilter.totalCount).toBe(0);
    expect(forbiddenFilter.edges).toEqual([]);
    owner = "bob";
    expect(await service.getJob("reports:alice")).toBeNull();
    expect((await service.getJob("reports:bob"))?.id).toBe("reports:bob");
  });

  it("allows unscoped reads only when the callback explicitly grants them", async () => {
    const service = new JobService(orm.em.fork(), {
      getJobReadFilter: () => ({}),
    });
    expect((await service.getJobConnection({ first: 10 })).totalCount).toBe(2);
  });
});
