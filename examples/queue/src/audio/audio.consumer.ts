import { Consumer, Job, QueueConsumer } from '@nest-boot/queue';
import { Logger } from '@nestjs/common';

@Consumer('audio')
export class AudioConsumer implements QueueConsumer {
  private readonly logger = new Logger(AudioConsumer.name);

  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  async consume(job: Job) {
    this.logger.debug('Start transcoding...');
    this.logger.debug(job.data);
    this.logger.debug('Transcoding completed');
    this.job = job;
  }
}
