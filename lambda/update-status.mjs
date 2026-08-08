import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

// Region resolves from AWS_REGION, which the Lambda runtime sets; see process-image.mjs.
const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || "image-metadata";

export const handler = async (event) => {
  const { imageId, newStatus } = JSON.parse(event.body || "{}");

  if (!imageId || !newStatus) {
    return { statusCode: 400, body: JSON.stringify({ error: "imageId and newStatus required" }) };
  }

  const validStatuses = ["completed", "delivered", "failed"];
  if (!validStatuses.includes(newStatus)) {
    return { statusCode: 400, body: JSON.stringify({ error: `Invalid status. Allowed: ${validStatuses.join(", ")}` }) };
  }

  try {
    await ddb.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { imageId: { S: imageId } },
      UpdateExpression: "SET #s = :s, updatedAt = :t",
      // Without this guard UpdateItem is an upsert: an unknown imageId would create a
      // record holding nothing but a status, and the caller would get a 200 back.
      ConditionExpression: "attribute_exists(imageId)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": { S: newStatus },
        ":t": { S: new Date().toISOString() },
      },
    }));

    return { statusCode: 200, body: JSON.stringify({ message: "Status updated", imageId, newStatus }) };
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 404, body: JSON.stringify({ error: `No image found with imageId ${imageId}` }) };
    }

    console.error("Update failed:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};