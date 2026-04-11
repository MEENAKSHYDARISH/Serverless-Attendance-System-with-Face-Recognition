const AWS = require('aws-sdk');
const { localDateParts } = require('../common/time');

const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

exports.handler = async () => {
  const { date } = localDateParts(process.env.TZ || 'Asia/Kolkata');

  const employeesResp = await ddb.scan({
    TableName: process.env.EMPLOYEES_TABLE,
    FilterExpression: 'is_active = :a',
    ExpressionAttributeValues: { ':a': true },
  }).promise();

  const attendanceResp = await ddb.query({
    TableName: process.env.ATTENDANCE_TABLE,
    IndexName: 'DateStatusIndex',
    KeyConditionExpression: '#d = :date',
    ExpressionAttributeNames: { '#d': 'date' },
    ExpressionAttributeValues: { ':date': date },
  }).promise();

  const todayItems = attendanceResp.Items || [];
  const presentSet = new Set(todayItems.map((x) => x.employee_id));

  for (const employee of employeesResp.Items || []) {
    if (presentSet.has(employee.employee_id)) continue;
    await ddb.put({
      TableName: process.env.ATTENDANCE_TABLE,
      Item: { employee_id: employee.employee_id, date, status: 'ABSENT', employee_name: employee.name },
      ConditionExpression: 'attribute_not_exists(employee_id) AND attribute_not_exists(#d)',
      ExpressionAttributeNames: { '#d': 'date' },
    }).promise();
  }

  const postResp = await ddb.query({
    TableName: process.env.ATTENDANCE_TABLE,
    IndexName: 'DateStatusIndex',
    KeyConditionExpression: '#d = :date',
    ExpressionAttributeNames: { '#d': 'date' },
    ExpressionAttributeValues: { ':date': date },
  }).promise();

  const all = postResp.Items || [];
  const summary = {
    date,
    total_active: (employeesResp.Items || []).length,
    present: all.filter((x) => x.status === 'PRESENT').length,
    late: all.filter((x) => x.status === 'LATE').length,
    absent: all.filter((x) => x.status === 'ABSENT').length,
  };

  await s3.putObject({ Bucket: process.env.REPORTS_BUCKET, Key: `daily/${date}.json`, Body: JSON.stringify(summary, null, 2), ContentType: 'application/json' }).promise();
  await s3.putObject({ Bucket: process.env.REPORTS_BUCKET, Key: `daily/${date}.csv`, Body: `date,total_active,present,late,absent\n${summary.date},${summary.total_active},${summary.present},${summary.late},${summary.absent}\n`, ContentType: 'text/csv' }).promise();

  return summary;
};
