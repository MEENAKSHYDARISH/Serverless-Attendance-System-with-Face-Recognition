const {
  RekognitionClient,
  IndexFacesCommand,
} = require("@aws-sdk/client-rekognition");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { json, badRequest, forbidden } = require("./common/http");
const { hasAdminAccess } = require("./common/auth");
const { S3Client } = require("@aws-sdk/client-s3");
const {
  CognitoIdentityProviderClient,
} = require("@aws-sdk/client-cognito-identity-provider");

const rekognition = new RekognitionClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  console.log(
    "JWT CLAIMS:",
    JSON.stringify(event.requestContext?.authorizer?.jwt?.claims, null, 2),
  );
  if (!hasAdminAccess(event)) return forbidden("Admin group required");

  const body = JSON.parse(event.body || "{}");
  const employeeId = body.employee_id;
  const s3Key = body.s3_key;
  const name = body.name;
  const department = body.department || "General";
  const shiftStartLocal = body.shift_start_local || "09:00:00";

  if (!employeeId || !s3Key || !name)
    return badRequest("employee_id, name and s3_key are required");

  const indexResp = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: process.env.REKOGNITION_COLLECTION_ID,
      Image: {
        S3Object: { Bucket: process.env.EMPLOYEE_PHOTOS_BUCKET, Name: s3Key },
      },
      ExternalImageId: employeeId,
      MaxFaces: 1,
      QualityFilter: "HIGH",
      DetectionAttributes: ["DEFAULT"],
    }),
  );

  if (!indexResp.FaceRecords || indexResp.FaceRecords.length !== 1) {
    return badRequest("Photo must contain exactly one clear face");
  }

  const faceId = indexResp.FaceRecords[0].Face.FaceId;

  await ddb.send(
    new UpdateCommand({
      TableName: process.env.EMPLOYEES_TABLE,
      Key: { employee_id: employeeId },
      UpdateExpression:
        "SET #n=:n, department=:d, shift_start_local=:s, face_id=:f, is_active=:a",
      ExpressionAttributeNames: { "#n": "name" },
      ExpressionAttributeValues: {
        ":n": name,
        ":d": department,
        ":s": shiftStartLocal,
        ":f": faceId,
        ":a": true,
      },
    }),
  );
  console.log("NEW VERSION DEPLOYED 🚀");
  return json(200, {
    employee_id: employeeId,
    face_id: faceId,
    collection_id: process.env.REKOGNITION_COLLECTION_ID,
  });
};
