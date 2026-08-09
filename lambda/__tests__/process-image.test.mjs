import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import sharp from "sharp";

const s3Mock = mockClient(S3Client);
const ddbMock = mockClient(DynamoDBClient);
const snsMock = mockClient(SNSClient);

const BUCKET = "test-image-bucket";

/** An oversized PNG, so we can assert the resize + JPEG conversion actually happened. */
const makeSourceImage = () =>
  sharp({
    create: { width: 1600, height: 1200, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();

/** Mirrors the shape S3 actually sends, including the per-object eTag the imageId is built from. */
const s3Record = (key, overrides = {}) => ({
  eventTime: "2026-08-08T10:00:00.000Z",
  s3: { bucket: { name: BUCKET }, object: { key, eTag: "d41d8cd98f00b204e9800998ecf8427e", ...overrides } },
});

const s3Event = (key, overrides) => ({ Records: [s3Record(key, overrides)] });

/** The handler reads env vars at import time, so it must be imported after they are set. */
const loadHandler = async () => (await import("../process-image.mjs?t=" + Math.random())).handler;

describe("process-image handler", () => {
  let source;

  beforeEach(async () => {
    s3Mock.reset();
    ddbMock.reset();
    snsMock.reset();
    delete process.env.SNS_TOPIC_ARN;

    source = await makeSourceImage();
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => source },
      ContentType: "image/png",
      ContentLength: source.length,
    });
    s3Mock.on(PutObjectCommand).resolves({});
    ddbMock.on(PutItemCommand).resolves({});
  });

  it("writes the resized image to the processed/ prefix as JPEG", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Bucket).toBe(BUCKET);
    expect(put.Key).toBe("processed/photo.jpg");
    expect(put.ContentType).toBe("image/jpeg");

    const meta = await sharp(put.Body).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeLessThanOrEqual(800);
    expect(meta.height).toBeLessThanOrEqual(800);
  });

  it("never writes back into uploads/, so it cannot re-trigger itself", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key.startsWith("uploads/")).toBe(false);
  });

  it("records completed metadata with both byte sizes in DynamoDB", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png"));

    const item = ddbMock.commandCalls(PutItemCommand)[0].args[0].input.Item;
    expect(item.status.S).toBe("completed");
    expect(item.originalKey.S).toBe("uploads/photo.png");
    expect(item.processedKey.S).toBe("processed/photo.jpg");
    expect(Number(item.sizeIn.N)).toBe(source.length);
    expect(Number(item.sizeOut.N)).toBeGreaterThan(0);
  });

  it("URL-decodes keys that S3 delivers with escaped characters", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/my+holiday%20pic.png"));

    const item = ddbMock.commandCalls(PutItemCommand)[0].args[0].input.Item;
    expect(item.originalKey.S).toBe("uploads/my holiday pic.png");
  });

  it("records a failed status instead of throwing when S3 read fails", async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error("AccessDenied"));

    const handler = await loadHandler();
    await expect(handler(s3Event("uploads/photo.png"))).resolves.toBeUndefined();

    const item = ddbMock.commandCalls(PutItemCommand)[0].args[0].input.Item;
    expect(item.status.S).toBe("failed");
    expect(item.error.S).toBe("AccessDenied");
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it("publishes to SNS only when a topic ARN is configured", async () => {
    process.env.SNS_TOPIC_ARN = "arn:aws:sns:ap-south-1:123456789012:image-done";
    snsMock.on(PublishCommand).resolves({});

    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png"));

    const published = snsMock.commandCalls(PublishCommand);
    expect(published).toHaveLength(1);
    expect(JSON.parse(published[0].args[0].input.Message).status).toBe("completed");
  });

  it("skips SNS when no topic ARN is configured", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png"));

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it("gives two same-named uploads distinct imageIds instead of overwriting one item", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png", { eTag: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }));
    await handler(s3Event("uploads/photo.png", { eTag: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }));

    const [first, second] = ddbMock.commandCalls(PutItemCommand).map((c) => c.args[0].input.Item);
    expect(first.imageId.S).not.toBe(second.imageId.S);
    expect(first.originalKey.S).toBe(second.originalKey.S);
  });

  it("prefers the S3 versionId over the eTag when the bucket is versioned", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.png", { versionId: "3HL4kqtJlcpXroDTDmjVBH40Nrjfkd" }));

    const item = ddbMock.commandCalls(PutItemCommand)[0].args[0].input.Item;
    expect(item.imageId.S).toBe("uploads/photo.png#3HL4kqtJlcpXroDTDmjVBH40Nrjfkd");
  });

  it("falls back to the event time when S3 sends neither a versionId nor an eTag", async () => {
    const handler = await loadHandler();
    await handler({ Records: [{ eventTime: "2026-08-08T10:00:00.000Z", s3: { bucket: { name: BUCKET }, object: { key: "uploads/photo.png" } } }] });

    const item = ddbMock.commandCalls(PutItemCommand)[0].args[0].input.Item;
    expect(item.imageId.S).toBe("uploads/photo.png#2026-08-08T10:00:00.000Z");
  });

  it("handles a key that is not under uploads/ without mangling the output path", async () => {
    const handler = await loadHandler();
    await handler(s3Event("photo.png"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key).toBe("processed/photo.jpg");
  });

  it("keeps the upload's folder structure so same-named files in different folders survive", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/2026/august/photo.png"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key).toBe("processed/2026/august/photo.jpg");
  });

  it("rewrites the extension to .jpg so the key matches the JPEG bytes it holds", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo.PNG"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key).toBe("processed/photo.jpg");
  });

  it("appends .jpg when the upload has no extension at all", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/photo"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key).toBe("processed/photo.jpg");
  });

  it("only rewrites the filename's extension, not a dot in a folder name", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/2026.08/photo"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key).toBe("processed/2026.08/photo.jpg");
  });

  it("treats a leading dot as part of the name rather than as an extension", async () => {
    const handler = await loadHandler();
    await handler(s3Event("uploads/.photo"));

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Key).toBe("processed/.photo.jpg");
  });

  it("processes every record in a batched event", async () => {
    const handler = await loadHandler();
    await handler({
      Records: [s3Record("uploads/a.png"), s3Record("uploads/b.png")],
    });

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(2);
    expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(2);
  });
});
