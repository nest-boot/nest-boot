import { Module } from '@nestjs/common';

import { AudioConsumer } from './audio.consumer';
import { AudioController } from './audio.controller';

@Module({
  controllers: [AudioController],
  providers: [AudioConsumer],
})
export class AudioModule {}
