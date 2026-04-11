# Runbook

## Deploy
1. `npm install`
2. `npx cdk bootstrap`
3. `npm run cdk:deploy:dev -- -c env=dev -c region=ap-south-1`
4. From stack outputs, copy API base URL and Cognito IDs.
5. Update `web/js/config.js` token and API URL for local validation.

## Create Rekognition collection
The stack outputs collection id. Create it once:

```bash
aws rekognition create-collection --collection-id <collection-id> --region ap-south-1
```

## Register admin user
1. Create a Cognito user.
2. Add user to `admin` group.
3. Obtain ID token and set in `web/js/config.js`.

## Alarms to add
- Lambda `Errors > 0` for all critical functions
- DLQ `ApproximateNumberOfMessagesVisible > 0`
- API Gateway 5XX and 4XX anomaly alarms
- DynamoDB throttles

## Incident triage
- Check CloudWatch logs for request id and upload id.
- Check `upload_results` record for final pipeline state.
- Check recognition DLQ for persistent failures.
