const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("node:crypto");
const { json } = require("./common/http");

// Same config as before (important for presigned URL stability)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  forcePathStyle: false,
  requestChecksumCalculation: "NEVER",
  responseChecksumValidation: "NEVER",
});

exports.handler = async () => {
  const uploadId = crypto.randomUUID();

  // ✅ KEY CHANGE: use raw/ for check-in
  const key = `raw/${uploadId}.jpg`;

  const command = new PutObjectCommand({
    Bucket: process.env.RAW_UPLOAD_BUCKET, // 👈 IMPORTANT (not employee bucket)
    Key: key,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300,
  });

  return json(200, {
    uploadId,
    s3Key: key,
    uploadUrl,
  });
};
