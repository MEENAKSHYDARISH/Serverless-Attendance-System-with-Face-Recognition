const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});

exports.handler = async () => {
  const threshold = Date.now() - (60 * 60 * 1000);
  let continuationToken;
  let deleted = 0;

  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.RAW_UPLOAD_BUCKET,
      Prefix: 'raw/',
      ContinuationToken: continuationToken,
    }));

    for (const obj of page.Contents || []) {
      const lastModified = new Date(obj.LastModified).getTime();
      if (lastModified < threshold) {
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.RAW_UPLOAD_BUCKET,
          Key: obj.Key,
        }));
        deleted += 1;
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return { deleted };
};