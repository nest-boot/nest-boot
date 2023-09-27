import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { FileUploadModule, FileUploadService } from '@nest-boot/file-upload';
import bytes from 'bytes';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FileUploadModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const bucket = configService.get('S3_BUCKET');

        if (bucket === undefined) {
          throw new Error('S3_BUCKET is not defined');
        }

        return {
          bucket,
          endpoint: configService.get('S3_ENDPOINT'),
          accessKeyId: configService.get('S3_ACCESS_KEY_ID'),
          secretAccessKey: configService.get('S3_SECRET_KEY'),
          s3ForcePathStyle: true,
          limits: [
            {
              fileSize: bytes('20mb'),
              mimeTypes: [
                'text/csv',
                'image/jpeg',
                'image/png',
                'video/*',
                'video/x-m4v',
                'video/webm',
                'video/x-ms-wmv',
                'video/x-msvideo',
                'video/3gpp',
                'video/flv',
                'video/x-flv',
                'video/mp4',
                'video/quicktime',
                'video/mpeg',
                'video/ogv',
              ],
            },
          ],
        };
      },
    }),
  ],
})
export class AppModule {}
