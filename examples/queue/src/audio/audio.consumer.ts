import { Logger } from '@nestjs/common';
import { Job, QueueConsumer, Consumer } from '@nest-boot/queue';

@Consumer('audio')
export class AudioConsumer implements QueueConsumer {
  private readonly logger = new Logger(AudioConsumer.name);

  job?: Job;

  async consume(job: Job) {
    this.logger.debug('Start transcoding...');
    this.logger.debug(job.data);
    this.logger.debug('Transcoding completed');
    this.job = job;
  }
}
