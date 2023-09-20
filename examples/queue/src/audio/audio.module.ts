import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioConsumer } from './audio.consumer';

@Module({
  controllers: [AudioController],
  providers: [AudioConsumer],
})
export class AudioModule {}
