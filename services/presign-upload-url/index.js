const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("node:crypto");
const { json } = require("./common/http");

const s3 = new S3Client({}); // ✅ FIXED

exports.handler = async () => {
  const uploadId = crypto.randomUUID();
  const key = `employees/${uploadId}.jpg`;

  const command = new PutObjectCommand({
    Bucket: process.env.EMPLOYEE_PHOTOS_BUCKET,
    Key: key,
    ContentType: "image/jpeg",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return json(200, {
    uploadId: uploadId,
    s3Key: key,
    uploadUrl: uploadUrl,
    expiresInSeconds: 300,
  });
};
