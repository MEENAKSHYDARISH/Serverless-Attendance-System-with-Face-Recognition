const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { json, badRequest } = require("./common/http");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  const uploadId = event?.pathParameters?.upload_id;
  if (!uploadId) return badRequest("upload_id is required");

  const result = await ddb.send(
    new GetCommand({
      TableName: process.env.UPLOAD_RESULTS_TABLE,
      Key: { upload_id: uploadId },
    }),
  );

  if (!result.Item) return json(200, { state: "PENDING", upload_id: uploadId });
  return json(200, result.Item);
};
