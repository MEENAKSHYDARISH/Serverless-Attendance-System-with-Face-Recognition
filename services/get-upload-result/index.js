const AWS = require('aws-sdk');
const { json, badRequest } = require('../common/http');

const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const uploadId = event?.pathParameters?.upload_id;
  if (!uploadId) return badRequest('upload_id is required');

  const result = await ddb.get({
    TableName: process.env.UPLOAD_RESULTS_TABLE,
    Key: { upload_id: uploadId },
  }).promise();

  if (!result.Item) return json(200, { state: 'PENDING', upload_id: uploadId });
  return json(200, result.Item);
};
