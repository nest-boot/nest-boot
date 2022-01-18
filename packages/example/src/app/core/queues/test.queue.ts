import { BaseQueue, Job, Queue } from "@nest-boot/queue";

@Queue()
export class TestQueue extends BaseQueue {
  async processor(job: Job): Promise<void> {
    // eslint-disable-next-line no-console
    console.log("job id:", job.id);
  }
}
