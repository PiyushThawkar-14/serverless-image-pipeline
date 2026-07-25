import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { handler } from "../update-status.mjs";

const ddbMock = mockClient(DynamoDBClient);

const request = (payload) => ({ body: payload === undefined ? undefined : JSON.stringify(payload) });
const parse = (response) => JSON.parse(response.body);

describe("update-status handler", () => {
  beforeEach(() => {
    ddbMock.reset();
    ddbMock.on(UpdateItemCommand).resolves({});
  });

  it("updates the status and echoes it back", async () => {
    const response = await handler(request({ imageId: "photo.png", newStatus: "delivered" }));

    expect(response.statusCode).toBe(200);
    expect(parse(response)).toMatchObject({ imageId: "photo.png", newStatus: "delivered" });

    const input = ddbMock.commandCalls(UpdateItemCommand)[0].args[0].input;
    expect(input.Key.imageId.S).toBe("photo.png");
    expect(input.ExpressionAttributeValues[":s"].S).toBe("delivered");
    expect(input.ExpressionAttributeValues[":t"].S).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("aliases the reserved word 'status' so DynamoDB accepts the update", async () => {
    await handler(request({ imageId: "photo.png", newStatus: "completed" }));

    const input = ddbMock.commandCalls(UpdateItemCommand)[0].args[0].input;
    expect(input.ExpressionAttributeNames["#s"]).toBe("status");
  });

  it.each(["completed", "delivered", "failed"])("accepts the valid status %s", async (status) => {
    const response = await handler(request({ imageId: "photo.png", newStatus: status }));
    expect(response.statusCode).toBe(200);
  });

  it("rejects an unknown status with 400", async () => {
    const response = await handler(request({ imageId: "photo.png", newStatus: "banana" }));

    expect(response.statusCode).toBe(400);
    expect(parse(response).error).toContain("Invalid status");
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it.each([
    ["missing imageId", { newStatus: "delivered" }],
    ["missing newStatus", { imageId: "photo.png" }],
    ["empty payload", {}],
  ])("rejects %s with 400", async (_label, payload) => {
    const response = await handler(request(payload));

    expect(response.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it("treats an absent body as an empty payload rather than crashing", async () => {
    const response = await handler(request(undefined));
    expect(response.statusCode).toBe(400);
  });

  it("returns 500 when DynamoDB rejects the write", async () => {
    ddbMock.on(UpdateItemCommand).rejects(new Error("ProvisionedThroughputExceeded"));

    const response = await handler(request({ imageId: "photo.png", newStatus: "delivered" }));

    expect(response.statusCode).toBe(500);
    expect(parse(response).error).toBe("ProvisionedThroughputExceeded");
  });
});
