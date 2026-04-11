# AWS Cost Sheet (Estimated)

Assumptions:
- 100 employees
- 2 face recognition calls per employee per day
- 30 days/month
- Region: ap-south-1 (verify exact regional pricing before production)

## Estimated monthly usage
- Rekognition search calls: 100 * 2 * 30 = 6,000
- Rekognition indexing calls (one-time): 100
- Lambda invocations: ~10,000 to 30,000 (including polling and schedulers)
- DynamoDB: low-volume on-demand reads/writes
- S3: low storage due to 1-hour raw retention

## Cost drivers
1. Rekognition API usage is the primary cost component.
2. CloudFront data transfer can become material if admin UI/report traffic grows.
3. Lambda and DynamoDB remain minor at this scale.

## Buffer recommendation
Add 20-30% budget buffer for:
- retries
- low-confidence reattempts
- higher polling frequency

Use AWS Pricing Calculator with your final region, traffic profile, and retention policy for final approval numbers.
