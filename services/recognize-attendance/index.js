const AWS = require('aws-sdk');
const { localDateParts, toEpochSecondsPlus } = require('../common/time');

const rekognition = new AWS.Rekognition();
const ddb = new AWS.DynamoDB.DocumentClient();

function buildStatus(clockInTime, shiftStart) {
  if (!clockInTime || !shiftStart) return 'PRESENT';
  return clockInTime > shiftStart ? 'LATE' : 'PRESENT';
}

async function putResult(uploadId, payload) {
  await ddb.put({
    TableName: process.env.UPLOAD_RESULTS_TABLE,
    Item: { upload_id: uploadId, ...payload, expires_at: toEpochSecondsPlus(24) },
  }).promise();
}

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const uploadId = key.split('/').pop()?.replace('.jpg', '') || `unknown-${Date.now()}`;

    try {
      const search = await rekognition.searchFacesByImage({
        CollectionId: process.env.REKOGNITION_COLLECTION_ID,
        Image: { S3Object: { Bucket: bucket, Name: key } },
        FaceMatchThreshold: Number(process.env.MATCH_THRESHOLD || '90'),
        MaxFaces: 1,
      }).promise();

      const topMatch = search.FaceMatches?.[0];
      if (!topMatch || Number(topMatch.Similarity || 0) < Number(process.env.MATCH_THRESHOLD || '90')) {
        await putResult(uploadId, { state: 'COMPLETED', action: 'none', status: 'UNRECOGNIZED', message: 'No confident match found', processed_at: new Date().toISOString() });
        continue;
      }

      const employeeId = topMatch.Face?.ExternalImageId;
      const confidence = Number(topMatch.Similarity || 0).toFixed(2);
      if (!employeeId) {
        await putResult(uploadId, { state: 'FAILED', action: 'none', status: 'ERROR', message: 'Matched face has no employee mapping', processed_at: new Date().toISOString() });
        continue;
      }

      const { date, time, iso } = localDateParts(process.env.TZ || 'Asia/Kolkata');

      const employeeResp = await ddb.get({ TableName: process.env.EMPLOYEES_TABLE, Key: { employee_id: employeeId } }).promise();
      const employee = employeeResp.Item;
      if (!employee || employee.is_active === false) {
        await putResult(uploadId, { state: 'COMPLETED', employee_id: employeeId, action: 'none', status: 'INACTIVE', message: 'Employee is inactive or not found', processed_at: iso });
        continue;
      }

      const attendanceResp = await ddb.get({ TableName: process.env.ATTENDANCE_TABLE, Key: { employee_id: employeeId, date } }).promise();
      const existing = attendanceResp.Item;

      if (!existing) {
        const status = buildStatus(time, employee.shift_start_local);
        await ddb.put({
          TableName: process.env.ATTENDANCE_TABLE,
          Item: {
            employee_id: employeeId,
            date,
            clock_in_ts: iso,
            status,
            confidence: Number(confidence),
            source_upload_id: uploadId,
            employee_name: employee.name,
          },
          ConditionExpression: 'attribute_not_exists(employee_id) AND attribute_not_exists(#d)',
          ExpressionAttributeNames: { '#d': 'date' },
        }).promise();

        await putResult(uploadId, { state: 'COMPLETED', employee_id: employeeId, name: employee.name, action: 'CLOCK_IN', status, matched_confidence: Number(confidence), processed_at: iso });
        continue;
      }

      if (!existing.clock_out_ts) {
        await ddb.update({
          TableName: process.env.ATTENDANCE_TABLE,
          Key: { employee_id: employeeId, date },
          UpdateExpression: 'SET clock_out_ts=:co',
          ExpressionAttributeValues: { ':co': iso },
        }).promise();

        await putResult(uploadId, { state: 'COMPLETED', employee_id: employeeId, name: employee.name, action: 'CLOCK_OUT', status: existing.status, matched_confidence: Number(confidence), processed_at: iso });
        continue;
      }

      await putResult(uploadId, { state: 'COMPLETED', employee_id: employeeId, name: employee.name, action: 'ALREADY_COMPLETE', status: existing.status, matched_confidence: Number(confidence), processed_at: iso });
    } catch (error) {
      await putResult(uploadId, { state: 'FAILED', action: 'none', status: 'ERROR', message: error.message, processed_at: new Date().toISOString() });
      throw error;
    }
  }
};
