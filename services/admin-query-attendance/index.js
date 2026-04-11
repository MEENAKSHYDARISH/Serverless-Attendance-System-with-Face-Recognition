const AWS = require('aws-sdk');
const { json, forbidden } = require('../common/http');
const { hasAdminAccess } = require('../common/auth');

const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  if (!hasAdminAccess(event)) return forbidden('Admin group required');

  const qs = event.queryStringParameters || {};
  const employeeId = qs.employee_id;
  const status = qs.status;
  const dateFrom = qs.date_from;
  const dateTo = qs.date_to;
  const limit = Number(qs.limit || '100');

  if (employeeId) {
    const data = await ddb.query({
      TableName: process.env.ATTENDANCE_TABLE,
      KeyConditionExpression: 'employee_id = :e AND #d BETWEEN :from AND :to',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: {
        ':e': employeeId,
        ':from': dateFrom || '0000-01-01',
        ':to': dateTo || '9999-12-31',
      },
      Limit: limit,
      ScanIndexForward: false,
    }).promise();

    const items = status ? (data.Items || []).filter((x) => x.status === status) : (data.Items || []);
    return json(200, { items });
  }

  const scan = await ddb.scan({ TableName: process.env.ATTENDANCE_TABLE, Limit: limit }).promise();
  const items = (scan.Items || []).filter((x) => {
    if (status && x.status !== status) return false;
    if (dateFrom && x.date < dateFrom) return false;
    if (dateTo && x.date > dateTo) return false;
    return true;
  });
  return json(200, { items });
};
