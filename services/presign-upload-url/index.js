const AWS = require('aws-sdk');
const crypto = require('node:crypto');
const { json } = require('../common/http');

const s3 = new AWS.S3({ signatureVersion: 'v4' });

exports.handler = async () => {
  const uploadId = crypto.randomUUID();
  const key = `raw/${uploadId}.jpg`;

  const uploadUrl = s3.getSignedUrl('putObject', {
    Bucket: process.env.RAW_UPLOAD_BUCKET,
    Key: key,
    ContentType: 'image/jpeg',
    Expires: 300,
    Metadata: { upload_id: uploadId },
  });

  return json(200, { upload_id: uploadId, s3_key: key, upload_url: uploadUrl, expires_in_seconds: 300 });
};
