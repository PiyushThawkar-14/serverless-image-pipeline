import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import sharp from "sharp";

// No explicit region: the SDK resolves it from AWS_REGION, which the Lambda runtime always
// sets. Hardcoding ap-south-1 meant a copy of this function deployed anywhere else would
// silently keep reading and writing in Mumbai.
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const sns = new SNSClient({});

const TABLE_NAME = process.env.TABLE_NAME || "image-metadata";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
const UPLOAD_PREFIX = "uploads/";
const PROCESSED_PREFIX = "processed/";
const OUTPUT_EXTENSION = ".jpg";

/**
 * The partition key has to identify one upload, not one filename. Keying on the basename
 * meant two users uploading photo.png shared a single DynamoDB item, so the second upload
 * erased the first one's metadata. S3 gives us a per-object identity in the event itself:
 * versionId on a versioned bucket, otherwise the eTag content hash. eventTime is a last
 * resort so a malformed event still produces a distinct key rather than a colliding one.
 */
const buildImageId = ({ s3: { object }, eventTime }, key) => {
  const version = object.versionId || object.eTag?.replace(/"/g, "") || eventTime;
  return `${key}#${version}`;
};

/**
 * The output is always JPEG, so the key has to say so. Carrying the source extension meant
 * processed/photo.png held JPEG bytes — browsers cope because ContentType is right, but
 * anything that trusts the extension (CDN rules, downloads, S3 lifecycle filters) does not.
 * Only the basename's extension is replaced, so a folder named 2026.08/ survives, and a
 * leading dot is treated as part of the name rather than as an extension.
 */
const toJpegExtension = (key) => {
  const dot = key.lastIndexOf(".");
  const slash = key.lastIndexOf("/");
  return (dot > slash + 1 ? key.slice(0, dot) : key) + OUTPUT_EXTENSION;
};

/**
 * Mirrors the upload's folder structure under processed/ instead of flattening to the
 * basename, which used to make uploads/a/x.png and uploads/b/x.png overwrite each other.
 */
const buildProcessedKey = (key) =>
  PROCESSED_PREFIX +
  toJpegExtension(key.startsWith(UPLOAD_PREFIX) ? key.slice(UPLOAD_PREFIX.length) : key);

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const imageId = buildImageId(record, key);
    const timestamp = new Date().toISOString();

    console.log(`Processing: s3://${bucket}/${key}`);

    try {
      const { Body, ContentType, ContentLength } = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );

      const buffer = await Body.transformToByteArray();

      const output = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const processedKey = buildProcessedKey(key);

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: processedKey,
        Body: output,
        ContentType: "image/jpeg",
      }));

      await ddb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          imageId: { S: imageId },
          bucket: { S: bucket },
          originalKey: { S: key },
          processedKey: { S: processedKey },
          status: { S: "completed" },
          sizeIn: { N: String(ContentLength || 0) },
          sizeOut: { N: String(output.length) },
          timestamp: { S: timestamp },
        },
      }));

      if (SNS_TOPIC_ARN) {
        await sns.send(new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Message: JSON.stringify({ imageId, bucket, key: processedKey, status: "completed" }),
          Subject: "Image Processing Complete",
        }));
      }

      console.log(`✅ Processed: ${imageId} (${ContentLength} → ${output.length} bytes)`);
    } catch (err) {
      console.error(`❌ Error processing ${key}:`, err.message);

      await ddb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          imageId: { S: imageId },
          bucket: { S: bucket },
          originalKey: { S: key },
          processedKey: { S: "" },
          status: { S: "failed" },
          timestamp: { S: timestamp },
          error: { S: err.message },
        },
      }));
    }
  }
};