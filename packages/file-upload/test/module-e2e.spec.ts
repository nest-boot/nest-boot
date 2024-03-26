import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import axios from "axios";
import bytes from "bytes";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import request from "supertest";

import { FileUploadService } from "../src";
import { AppModule } from "./src/app.module";

describe("FileUploadModule - e2e", () => {
  let app: INestApplication;
  let fileUploadService: FileUploadService;

  const filename = "test.jpeg";
  const fileSize = 48445;
  const fileSizeLimited = bytes("100mb");
  const mimeType = "image/jpeg";
  const filePath = "./attachments/test.jpeg";

  let fileUploadArgs: {
    url: string;
    fields: Record<string, string>[];
  };

  // 临时文件的地址
  let fileTmpUrl: string;

  // 永久文件的地址
  // let fileUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    fileUploadService = module.get(FileUploadService);

    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 60000);

  it("成功获取上传参数配置", async () => {
    // 创建一个新桶
    const bucket = await fileUploadService.ossClient.bucketExists(
      fileUploadService.options.bucket,
    );

    if (!bucket) {
      await fileUploadService.ossClient.makeBucket(
        fileUploadService.options.bucket,
      );
    }

    const createFileUploads = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        query: /* GraphQL */ `
          mutation CreateFileUploads($input: [FileUploadInput!]!) {
            createFileUploads(input: $input) {
              url
              fields {
                name
                value
              }
            }
          }
        `,
        variables: {
          input: [
            {
              name: filename,
              fileSize,
              mimeType,
            },
          ],
        },
      });

    expect(createFileUploads.status).toBe(200);
    expect(createFileUploads.body.data.createFileUploads[0]).toBeTruthy();

    fileUploadArgs = createFileUploads.body.data.createFileUploads[0];
  }, 10000);

  it("成功上传临时文件", async () => {
    expect(fileUploadArgs).toBeTruthy();

    const form = new FormData();

    // 添加文件和其他字段到表单
    fileUploadArgs.fields.forEach((field) => {
      form.append(field.name, field.value);
    });

    const fileStream = fs.createReadStream(path.resolve(__dirname, filePath));
    form.append("file", fileStream);

    // 上传临时文件
    const response = await axios.post(fileUploadArgs.url, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    expect(response.status).toBe(201);

    fileTmpUrl = decodeURIComponent(
      response.data.match(/<Location>(.*?)<\/Location>/)[1],
    );

    expect(fileTmpUrl).toBeTruthy();
  }, 10000);

  it("成功将临时文件转为普通文件", async () => {
    expect(fileTmpUrl).toBeTruthy();

    const fileUrl = await fileUploadService.tmpAssetToFileAsset(fileTmpUrl);

    expect(fileUrl).toBeTruthy();
  }, 10000);

  it("文件过大，抛出异常", async () => {
    await expect(
      fileUploadService.create([
        { name: filename, fileSize: fileSizeLimited, mimeType },
      ]),
    ).rejects.toThrow();
  }, 10000);
});
