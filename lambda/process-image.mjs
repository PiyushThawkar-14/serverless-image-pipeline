import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import sharp from "sharp";

const s3 = new S3Client({ region: "ap-south-1" });
const ddb = new DynamoDBClient({ region: "ap-south-1" });
const sns = new SNSClient({ region: "ap-south-1" });

const TABLE_NAME = process.env.TABLE_NAME || "image-metadata";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const imageId = key.split("/").pop();
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

      const processedKey = `processed/${imageId}`;

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