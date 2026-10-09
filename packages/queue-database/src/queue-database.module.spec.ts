import { JobEntity } from "./entities/job.entity.js";
import { QueueDatabaseModule } from "./queue-database.module.js";
import { MODULE_OPTIONS_TOKEN } from "./queue-database.module-definition.js";

describe("QueueDatabaseModule", () => {
  it("should create a dynamic module with synchronous options", () => {
    const dynamicModule = QueueDatabaseModule.forRoot({
      jobEntity: JobEntity,
    });

    expect(dynamicModule.module).toBe(QueueDatabaseModule);
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

    const dynamicModule = QueueDatabaseModule.forRootAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(QueueDatabaseModule);
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
