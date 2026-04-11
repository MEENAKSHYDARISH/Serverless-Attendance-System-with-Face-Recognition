const AWS = require('aws-sdk');
const { json, badRequest, forbidden } = require('../common/http');
const { hasAdminAccess } = require('../common/auth');

const rekognition = new AWS.Rekognition();
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  if (!hasAdminAccess(event)) return forbidden('Admin group required');

  const body = JSON.parse(event.body || '{}');
  const employeeId = body.employee_id;
  const s3Key = body.s3_key;
  const name = body.name;
  const department = body.department || 'General';
  const shiftStartLocal = body.shift_start_local || '09:00:00';

  if (!employeeId || !s3Key || !name) return badRequest('employee_id, name and s3_key are required');

  const indexResp = await rekognition.indexFaces({
    CollectionId: process.env.REKOGNITION_COLLECTION_ID,
    Image: { S3Object: { Bucket: process.env.EMPLOYEE_PHOTOS_BUCKET, Name: s3Key } },
    ExternalImageId: employeeId,
    MaxFaces: 1,
    QualityFilter: 'HIGH',
    DetectionAttributes: ['DEFAULT'],
  }).promise();

  if (!indexResp.FaceRecords || indexResp.FaceRecords.length !== 1) {
    return badRequest('Photo must contain exactly one clear face');
  }

  const faceId = indexResp.FaceRecords[0].Face.FaceId;
  await ddb.update({
    TableName: process.env.EMPLOYEES_TABLE,
    Key: { employee_id: employeeId },
    UpdateExpression: 'SET #n=:n, department=:d, shift_start_local=:s, face_id=:f, is_active=:a',
    ExpressionAttributeNames: { '#n': 'name' },
    ExpressionAttributeValues: {
      ':n': name,
      ':d': department,
      ':s': shiftStartLocal,
      ':f': faceId,
      ':a': true,
    },
  }).promise();

  return json(200, { employee_id: employeeId, face_id: faceId, collection_id: process.env.REKOGNITION_COLLECTION_ID });
};
