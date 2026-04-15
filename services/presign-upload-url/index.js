const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("node:crypto");
const { json } = require("../common/http");

const s3 = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async () => {
  const uploadId = crypto.randomUUID();
  const key = `raw/${uploadId}.jpg`;

  const command = new PutObjectCommand({
    Bucket: process.env.RAW_UPLOAD_BUCKET,
    Key: key,
    ContentType: "image/jpeg",
    Metadata: { upload_id: uploadId },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return json(200, {
    upload_id: uploadId,
    s3_key: key,
    upload_url: uploadUrl,
    expires_in_seconds: 300,
  });
};