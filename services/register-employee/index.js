const { RekognitionClient, IndexFacesCommand } = require('@aws-sdk/client-rekognition');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { json, badRequest, forbidden } = require('../common/http');
const { hasAdminAccess } = require('../common/auth');

const rekognition = new RekognitionClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  try {
    if (!hasAdminAccess(event)) return forbidden('Admin group required');

    const body = JSON.parse(event.body || '{}');
    console.log('RegisterEmployee body:', body);

    const employeeId = body.employee_id;
    const s3Key = body.s3_key;
    const name = body.name;
    const email = body.email;
    const password = body.password;
    const department = body.department || 'General';
    const shiftStartLocal = body.shift_start_local || '09:00:00';

    if (!employeeId || !s3Key || !name || !email || !password) return badRequest('employee_id, name, email, password and s3_key are required');

    // Create Cognito user account
    try {
      await cognito.adminCreateUser({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
        MessageAction: 'SUPPRESS',
        TemporaryPassword: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: name.split(' ')[0] },
          { Name: 'family_name', Value: name.split(' ').slice(1).join(' ') || 'Employee' },
        ],
      });

      // Set permanent password
      await cognito.adminSetUserPassword({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
        Password: password,
        Permanent: true,
      });

      // Add user to employee group
      await cognito.adminAddUserToGroup({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
        GroupName: 'employee',
      });
    } catch (err) {
      console.error('Cognito user create error:', err);
      if (err.__type === 'UsernameExistsException' || err.message?.includes('An account with the given email already exists')) {
        return badRequest('User with this email already exists');
      }
      if (err.name === 'InvalidPasswordException' || err.Code === 'InvalidPasswordException') {
        return badRequest('Password does not meet Cognito password policy');
      }
      if (err.name === 'ResourceNotFoundException' || err.Code === 'ResourceNotFoundException') {
        return badRequest('Cognito user pool or group not found');
      }
      return badRequest(err.message || 'Failed to create Cognito user');
    }

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
  } catch (err) {
    console.error('RegisterEmployee handler error:', err);
    return json(500, { message: err.message || 'Internal server error' });
  }
}
