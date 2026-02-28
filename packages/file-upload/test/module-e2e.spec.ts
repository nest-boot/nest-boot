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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const fileSizeLimited = bytes("100mb")!;
  const mimeType = "image/jpeg";
  const filePath = "./attachments/test.jpeg";

  let fileUploadArgs: {
    url: string;
    fields: Record<string, string>[];
  };

  // Temporary file URL
  let fileTmpUrl: string;

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

  it("should successfully gets the upload parameter configuration", async () => {
    const createFileUploads = await request(app.getHttpServer())
      .post("/api/graphql")
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

  it("should successfully uploads temporary file", async () => {
    expect(fileUploadArgs).toBeTruthy();

    const form = new FormData();

    // Add file and other fields to the form
    fileUploadArgs.fields.forEach((field) => {
      form.append(field.name, field.value);
    });

    const fileStream = fs.createReadStream(path.resolve(__dirname, filePath));
    form.append("file", fileStream);

    // Upload temporary file
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

  it("should successfully persists the temporary file", async () => {
    expect(fileTmpUrl).toBeTruthy();

    const fileUrl = await fileUploadService.persist(fileTmpUrl);

    expect(fileUrl).toBeTruthy();
  }, 10000);

  it("should successfully upload temporary file", async () => {
    const buffer = fs.readFileSync(path.resolve(__dirname, filePath));

    const tmpFileUrl = await fileUploadService.upload(buffer, {
      "Content-Type": mimeType,
    });

    expect(tmpFileUrl).toBeTruthy();
    expect(tmpFileUrl).toContain("tmp");
  }, 10000);

  it("should successfully upload persistent file", async () => {
    const buffer = fs.readFileSync(path.resolve(__dirname, filePath));

    const fileUrl = await fileUploadService.upload(
      buffer,
      {
        "Content-Type": mimeType,
      },
      true,
    );

    expect(fileUrl).toBeTruthy();
    expect(fileUrl).toContain("file");
  }, 10000);

  it("file is too large, should throw an exception", async () => {
    await expect(
      fileUploadService.create([
        { name: filename, fileSize: fileSizeLimited, mimeType },
      ]),
    ).rejects.toThrow();
  }, 10000);
});
