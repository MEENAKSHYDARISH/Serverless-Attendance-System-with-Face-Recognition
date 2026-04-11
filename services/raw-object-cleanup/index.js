const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async () => {
  const threshold = Date.now() - (60 * 60 * 1000);
  let continuationToken;
  let deleted = 0;

  do {
    const page = await s3.listObjectsV2({
      Bucket: process.env.RAW_UPLOAD_BUCKET,
      Prefix: 'raw/',
      ContinuationToken: continuationToken,
    }).promise();

    for (const obj of page.Contents || []) {
      const lastModified = new Date(obj.LastModified).getTime();
      if (lastModified < threshold) {
        await s3.deleteObject({ Bucket: process.env.RAW_UPLOAD_BUCKET, Key: obj.Key }).promise();
        deleted += 1;
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return { deleted };
};
