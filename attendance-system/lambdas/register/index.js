const { RekognitionClient, IndexFacesCommand, ListFacesCommand } = require("@aws-sdk/client-rekognition");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const rek = new RekognitionClient({ region: process.env.AWS_REGION });
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {

  // --- Parse the incoming request ---
  // Admin calls this API with employee details + the S3 key of their photo
  const body = JSON.parse(event.body);
  const { employee_id, name, department, email, shift_start, s3_key } = body;

  // --- Basic validation ---
  if (!employee_id || !s3_key) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "employee_id and s3_key are required" })
    };
  }

  // --- Check if employee is already registered ---
  // (prevents duplicate faces in the collection)
  const listResult = await rek.send(new ListFacesCommand({
    CollectionId: "employee-faces",
    MaxResults: 1000
  }));
  const alreadyExists = listResult.Faces.some(f => f.ExternalImageId === employee_id);
  if (alreadyExists) {
    return {
      statusCode: 409,
      body: JSON.stringify({ error: `Employee ${employee_id} is already registered` })
    };
  }

  // --- Add face to Rekognition collection ---
  // IndexFaces reads the photo from S3 and stores the face vector
  const indexResult = await rek.send(new IndexFacesCommand({
    CollectionId: "employee-faces",
    Image: {
      S3Object: {
        Bucket: process.env.EMPLOYEE_PHOTOS_BUCKET,
        Name: s3_key                  // e.g. "photos/EMP001_john.jpg"
      }
    },
    ExternalImageId: employee_id,     // THIS links the face vector → employee_id
    DetectionAttributes: ["DEFAULT"],
    MaxFaces: 1,                      // only register 1 face per photo
    QualityFilter: "HIGH"             // reject blurry or poorly lit photos
  }));

  // --- Check Rekognition actually found a face ---
  if (!indexResult.FaceRecords || indexResult.FaceRecords.length === 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: "No face detected in the photo. Please use a clearer image." })
    };
  }

  const faceId = indexResult.FaceRecords[0].Face.FaceId;
  console.log(`Registered face for ${employee_id}, Rekognition FaceId: ${faceId}`);

  // --- Save employee details to DynamoDB ---
  await ddb.send(new PutItemCommand({
    TableName: process.env.EMPLOYEES_TABLE,
    Item: {
      employee_id: { S: employee_id },
      name:        { S: name },
      department:  { S: department },
      email:       { S: email },
      shift_start: { S: shift_start || "09:00" },
      face_id:     { S: faceId }
    }
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Employee ${name} registered successfully`,
      employee_id,
      face_id: faceId
    })
  };
};