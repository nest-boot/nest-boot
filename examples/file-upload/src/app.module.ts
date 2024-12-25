import { FileUploadModule } from '@nest-boot/file-upload';
import { GraphQLModule } from '@nest-boot/graphql';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import bytes from 'bytes';

import { ProductResolver } from './product/product.resolver';
import { ProductService } from './product/product.service';

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const GraphQLDynamicModule = GraphQLModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    playground: true,
    autoSchemaFile: './schema.gql',
    complexity: {
      rateLimit: {
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
        },
      },
    },
  }),
});

const FileUploadDynamicModule = FileUploadModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const bucket = configService.get('STORAGE_BUCKET');

    if (bucket === undefined) {
      throw new Error('S3 BUCKET is not defined');
    }

    return {
      bucket,
      endPoint: configService.getOrThrow('STORAGE_ENDPOINT'),
      ...(configService.get('STORAGE_PORT')
        ? { port: +configService.get('STORAGE_PORT') }
        : {}),
      ...(configService.get('STORAGE_USE_SSL')
        ? { useSSL: configService.get('STORAGE_USE_SSL') === 'true' }
        : {}),
      accessKey: configService.getOrThrow('STORAGE_ACCESS_KEY_ID'),
      secretKey: configService.getOrThrow('STORAGE_SECRET_KEY'),
      pathStyle: configService.get('STORAGE_PATH_STYLE') === 'true',
      limits: [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          fileSize: bytes('20mb')!,
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
});

@Module({
  imports: [ConfigDynamicModule, GraphQLDynamicModule, FileUploadDynamicModule],
  providers: [ProductService, ProductResolver],
})
export class AppModule {}
