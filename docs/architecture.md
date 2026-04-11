# Architecture Design

## Components
- Client: `web/index.html` (employee) and `web/admin.html` (admin)
- API: API Gateway HTTP API with Cognito JWT authorizer
- Compute: Lambda functions for upload URL, recognition, registration, queries, daily/weekly jobs, and cleanup
- AI: AWS Rekognition collection (`attendance-<env>-faces`)
- Data: DynamoDB tables `employees`, `attendance`, `upload_results`
- Storage: S3 buckets for raw captures, employee photos, reports, and static frontend
- Scheduling: EventBridge rules for daily closeout, weekly analytics, and 15-min cleanup
- Distribution: CloudFront in front of static website bucket with OAC

## End-to-end flow
1. User authenticates with Cognito.
2. Employee page requests pre-signed URL (`POST /upload-url`).
3. Browser uploads image directly to `s3://raw/...`.
4. S3 event triggers recognition Lambda.
5. Lambda matches face in Rekognition, writes attendance, and writes status in `upload_results`.
6. Frontend polls (`GET /result/{upload_id}`) until terminal state.
7. Admin page reads filtered attendance (`GET /admin/attendance`).
8. Daily scheduler marks absentees and writes daily summary to reports bucket.
9. Weekly scheduler writes org and per-employee analytics report.
10. Cleanup scheduler deletes raw images older than one hour.

## Security
- Least privilege per Lambda role (granted by CDK).
- Cognito JWT required for all API routes.
- Admin routes enforce Cognito `admin` group in Lambda.
- KMS encryption for DynamoDB + S3 data buckets.
- No raw image/base64 payload logged.
