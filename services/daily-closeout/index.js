const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { localDateParts } = require("./common/time");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

exports.handler = async () => {
  const { date } = localDateParts(process.env.TZ || "Asia/Kolkata");

  const employeesResp = await ddb.send(
    new ScanCommand({
      TableName: process.env.EMPLOYEES_TABLE,
      FilterExpression: "is_active = :a",
      ExpressionAttributeValues: { ":a": true },
    }),
  );

  const attendanceResp = await ddb.send(
    new QueryCommand({
      TableName: process.env.ATTENDANCE_TABLE,
      IndexName: "DateStatusIndex",
      KeyConditionExpression: "#d = :date",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":date": date },
    }),
  );

  const todayItems = attendanceResp.Items || [];
  const presentSet = new Set(todayItems.map((x) => x.employee_id));

  for (const employee of employeesResp.Items || []) {
    if (presentSet.has(employee.employee_id)) continue;
    try {
      await ddb.send(
        new PutCommand({
          TableName: process.env.ATTENDANCE_TABLE,
          Item: {
            employee_id: employee.employee_id,
            date,
            status: "ABSENT",
            employee_name: employee.name,
          },
          ConditionExpression:
            "attribute_not_exists(employee_id) AND attribute_not_exists(#d)",
          ExpressionAttributeNames: { "#d": "date" },
        }),
      );
    } catch (err) {
      // ConditionalCheckFailedException means record already exists — safe to skip
      if (err.name !== "ConditionalCheckFailedException") throw err;
    }
  }

  const postResp = await ddb.send(
    new QueryCommand({
      TableName: process.env.ATTENDANCE_TABLE,
      IndexName: "DateStatusIndex",
      KeyConditionExpression: "#d = :date",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":date": date },
    }),
  );

  const all = postResp.Items || [];
  const summary = {
    date,
    total_active: (employeesResp.Items || []).length,
    present: all.filter((x) => x.status === "PRESENT").length,
    late: all.filter((x) => x.status === "LATE").length,
    absent: all.filter((x) => x.status === "ABSENT").length,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.REPORTS_BUCKET,
      Key: `daily/${date}.json`,
      Body: JSON.stringify(summary, null, 2),
      ContentType: "application/json",
    }),
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.REPORTS_BUCKET,
      Key: `daily/${date}.csv`,
      Body: `date,total_active,present,late,absent\n${summary.date},${summary.total_active},${summary.present},${summary.late},${summary.absent}\n`,
      ContentType: "text/csv",
    }),
  );

  return summary;
};
