import { BullMQMikroORMModule } from "./bullmq-mikro-orm.module";
import { MODULE_OPTIONS_TOKEN } from "./bullmq-mikro-orm.module-definition";
import { JobEntity } from "./entities/job.entity";

describe("BullMQMikroORMModule", () => {
  it("should create a dynamic module with synchronous options", () => {
    const dynamicModule = BullMQMikroORMModule.forRoot({
      jobEntity: JobEntity,
    });

    expect(dynamicModule.module).toBe(BullMQMikroORMModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: {
            jobEntity: JobEntity,
          },
        },
      ]),
    );
  });

  it("should create a dynamic module with asynchronous options", () => {
    const useFactory = () => ({
      jobEntity: JobEntity,
    });

    const dynamicModule = BullMQMikroORMModule.forRootAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(BullMQMikroORMModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });
});
