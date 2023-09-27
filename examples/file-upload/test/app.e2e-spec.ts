import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { FileUploadService } from '@nest-boot/file-upload';
import bytes from 'bytes';

describe('FileUploadService (e2e)', () => {
  let app: INestApplication;
  let fileUploadService: FileUploadService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    fileUploadService = moduleFixture.get<FileUploadService>(FileUploadService);
  });

  it('should not throw an error when creating a file upload', async () => {
    expect(() =>
      fileUploadService.create([
        { name: 'test.jpeg', fileSize: bytes('100kb'), mimeType: 'image/jpeg' },
      ]),
    ).not.toThrow();
  });

  it('should throw an error because file is too large', async () => {
    expect(() =>
      fileUploadService.create([
        { name: 'test.jpeg', fileSize: bytes('30mb'), mimeType: 'image/jpeg' },
      ]),
    ).toThrow('The uploaded file does not meet the requirements');
  });
});
