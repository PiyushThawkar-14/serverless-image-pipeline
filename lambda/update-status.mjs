import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({ region: "ap-south-1" });
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
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": { S: newStatus },
        ":t": { S: new Date().toISOString() },
      },
    }));

    return { statusCode: 200, body: JSON.stringify({ message: "Status updated", imageId, newStatus }) };
  } catch (err) {
    console.error("Update failed:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};