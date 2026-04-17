const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { localDateParts } = require("./common/time");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

function mondayOfCurrentWeek(dateObj) {
  const d = new Date(dateObj);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d;
}

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

exports.handler = async () => {
  const { date } = localDateParts(process.env.TZ || "Asia/Kolkata");
  const now = new Date(`${date}T00:00:00Z`);
  const start = mondayOfCurrentWeek(now);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const startDate = toDateString(start);
  const endDate = toDateString(end);

  const attendance = await ddb.send(
    new ScanCommand({
      TableName: process.env.ATTENDANCE_TABLE,
    }),
  );
  const items = (attendance.Items || []).filter(
    (x) => x.date >= startDate && x.date <= endDate,
  );

  const byEmployee = {};
  for (const item of items) {
    byEmployee[item.employee_id] = byEmployee[item.employee_id] || {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      total: 0,
    };
    byEmployee[item.employee_id][item.status] =
      (byEmployee[item.employee_id][item.status] || 0) + 1;
    byEmployee[item.employee_id].total += 1;
  }

  const employees = Object.entries(byEmployee).map(([employeeId, m]) => ({
    employee_id: employeeId,
    present_pct: m.total ? Number(((m.PRESENT / m.total) * 100).toFixed(2)) : 0,
    late_pct: m.total ? Number(((m.LATE / m.total) * 100).toFixed(2)) : 0,
    absent_pct: m.total ? Number(((m.ABSENT / m.total) * 100).toFixed(2)) : 0,
    counts: m,
  }));

  const totals = employees.reduce(
    (acc, row) => {
      acc.present += row.counts.PRESENT;
      acc.late += row.counts.LATE;
      acc.absent += row.counts.ABSENT;
      acc.total += row.counts.total;
      return acc;
    },
    { present: 0, late: 0, absent: 0, total: 0 },
  );

  const summary = {
    week_start: startDate,
    week_end: endDate,
    org_present_pct: totals.total
      ? Number(((totals.present / totals.total) * 100).toFixed(2))
      : 0,
    org_late_pct: totals.total
      ? Number(((totals.late / totals.total) * 100).toFixed(2))
      : 0,
    org_absent_pct: totals.total
      ? Number(((totals.absent / totals.total) * 100).toFixed(2))
      : 0,
    totals,
    employees,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.REPORTS_BUCKET,
      Key: `weekly/${startDate}_to_${endDate}.json`,
      Body: JSON.stringify(summary, null, 2),
      ContentType: "application/json",
    }),
  );

  return summary;
};
