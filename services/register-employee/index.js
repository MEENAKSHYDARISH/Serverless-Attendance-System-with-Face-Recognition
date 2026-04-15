const { RekognitionClient, IndexFacesCommand } = require('@aws-sdk/client-rekognition');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { json, badRequest, forbidden } = require('../common/http');
const { hasAdminAccess } = require('../common/auth');

const rekognition = new RekognitionClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

exports.handler = async (event) => {
  if (!hasAdminAccess(event)) return forbidden('Admin group required');

  const body = JSON.parse(event.body || '{}');
  const employeeId = body.employee_id;
  const s3Key = body.s3_key;
  const name = body.name;
  const department = body.department || 'General';
  const shiftStartLocal = body.shift_start_local || '09:00:00';

  if (!employeeId || !s3Key || !name) return badRequest('employee_id, name and s3_key are required');

  // Copy image from raw bucket to employee photos bucket
  const employeePhotoKey = `employees/${employeeId}_${name.replace(/\s+/g, '_').toLowerCase()}.jpg`;
  await s3.send(new CopyObjectCommand({
    CopySource: `${process.env.RAW_UPLOAD_BUCKET}/${s3Key}`,
    Bucket: process.env.EMPLOYEE_PHOTOS_BUCKET,
    Key: employeePhotoKey,
  }));

  const indexResp = await rekognition.send(new IndexFacesCommand({
    CollectionId: process.env.REKOGNITION_COLLECTION_ID,
    Image: { S3Object: { Bucket: process.env.EMPLOYEE_PHOTOS_BUCKET, Name: employeePhotoKey } },
    ExternalImageId: employeeId,
    MaxFaces: 1,
    QualityFilter: 'HIGH',
    DetectionAttributes: ['DEFAULT'],
  }));

  if (!indexResp.FaceRecords || indexResp.FaceRecords.length !== 1) {
    return badRequest('Photo must contain exactly one clear face');
  }

  const faceId = indexResp.FaceRecords[0].Face.FaceId;

  await ddb.send(new UpdateCommand({
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
  }));

  return json(200, { employee_id: employeeId, face_id: faceId, collection_id: process.env.REKOGNITION_COLLECTION_ID });
};