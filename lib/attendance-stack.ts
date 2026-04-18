import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as kms from "aws-cdk-lib/aws-kms";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { StackProps } from "aws-cdk-lib";

interface AttendanceStackProps extends StackProps {
  envName: string;
}

export class AttendanceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AttendanceStackProps) {
    super(scope, id, props);

    const envName = props.envName;
    const appName = `attendance-${envName}`;

    const dataKey = new kms.Key(this, "DataKey", {
      alias: `alias/${appName}-data`,
      enableKeyRotation: true,
    });

    const rawUploadBucket = new s3.Bucket(this, "RawUploadBucket", {
      bucketName: `${appName}-raw-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryptionKey: dataKey,
      enforceSSL: true,
      eventBridgeEnabled: false,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    const employeePhotosBucket = new s3.Bucket(this, "EmployeePhotosBucket", {
      bucketName: `${appName}-employee-photos-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dataKey,
      enforceSSL: true,

      // 🔥 THIS IS THE FIX
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ["*"], // later restrict to your CloudFront domain
          allowedHeaders: ["*"],
        },
      ],
    });

    const reportsBucket = new s3.Bucket(this, "ReportsBucket", {
      bucketName: `${appName}-reports-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dataKey,
      enforceSSL: true,
    });

    const webBucket = new s3.Bucket(this, "WebBucket", {
      bucketName: `${appName}-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    const employeesTable = new dynamodb.Table(this, "EmployeesTable", {
      tableName: `${appName}-employees`,
      partitionKey: {
        name: "employee_id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dataKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const attendanceTable = new dynamodb.Table(this, "AttendanceTable", {
      tableName: `${appName}-attendance`,
      partitionKey: {
        name: "employee_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dataKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    attendanceTable.addGlobalSecondaryIndex({
      indexName: "DateStatusIndex",
      partitionKey: { name: "date", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const uploadResultsTable = new dynamodb.Table(this, "UploadResultsTable", {
      tableName: `${appName}-upload-results`,
      partitionKey: { name: "upload_id", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "expires_at",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dataKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const recognitionDlq = new sqs.Queue(this, "RecognitionDlq", {
      queueName: `${appName}-recognition-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dataKey,
    });

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${appName}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      authFlows: { userPassword: true, userSrp: true },
    });

    const adminGroup = new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "admin",
      description: "Attendance administrators",
    });
    adminGroup.node.addDependency(userPool);

    const baseEnv = {
      EMPLOYEES_TABLE: employeesTable.tableName,
      ATTENDANCE_TABLE: attendanceTable.tableName,
      UPLOAD_RESULTS_TABLE: uploadResultsTable.tableName,
      RAW_UPLOAD_BUCKET: rawUploadBucket.bucketName,
      EMPLOYEE_PHOTOS_BUCKET: employeePhotosBucket.bucketName,
      REPORTS_BUCKET: reportsBucket.bucketName,
      REKOGNITION_COLLECTION_ID: `${appName}-faces`,
      USER_POOL_ID: userPool.userPoolId,
      TZ: "Asia/Kolkata",
      MATCH_THRESHOLD: "90",
    };

    const nodeRuntime = lambda.Runtime.NODEJS_20_X;

    const presignFn = this.createFn(
      "PresignFn",
      "services/presign-upload-url",
      baseEnv,
      nodeRuntime,
    );
    const getResultFn = this.createFn(
      "GetResultFn",
      "services/get-upload-result",
      baseEnv,
      nodeRuntime,
    );
    const registerFn = this.createFn(
      "RegisterEmployeeFn",
      "services/register-employee",
      baseEnv,
      nodeRuntime,
    );
    const recognizeFn = this.createFn(
      "RecognizeAttendanceFn",
      "services/recognize-attendance",
      baseEnv,
      nodeRuntime,
      recognitionDlq,
    );
    const adminQueryFn = this.createFn(
      "AdminQueryAttendanceFn",
      "services/admin-query-attendance",
      baseEnv,
      nodeRuntime,
    );
    const dailyCloseoutFn = this.createFn(
      "DailyCloseoutFn",
      "services/daily-closeout",
      baseEnv,
      nodeRuntime,
    );
    const weeklyAnalyticsFn = this.createFn(
      "WeeklyAnalyticsFn",
      "services/weekly-analytics",
      baseEnv,
      nodeRuntime,
    );
    const rawCleanupFn = this.createFn(
      "RawObjectCleanupFn",
      "services/raw-object-cleanup",
      baseEnv,
      nodeRuntime,
    );
    const presignCheckinFn = this.createFn(
      "PresignCheckinFn",
      "services/presign-checkin-upload",
      baseEnv,
      nodeRuntime,
    );

    rawUploadBucket.grantPut(presignCheckinFn);
    rawUploadBucket.grantPut(presignFn, "raw/*");
    rawUploadBucket.grantRead(recognizeFn, "raw/*");
    rawUploadBucket.grantRead(registerFn, "raw/*");
    rawUploadBucket.grantReadWrite(rawCleanupFn, "raw/*");
    employeePhotosBucket.grantReadWrite(registerFn);
    reportsBucket.grantReadWrite(dailyCloseoutFn);
    reportsBucket.grantReadWrite(weeklyAnalyticsFn);
    employeePhotosBucket.grantPut(presignFn);

    employeesTable.grantReadWriteData(registerFn);
    employeesTable.grantReadData(recognizeFn);
    employeesTable.grantReadData(dailyCloseoutFn);

    attendanceTable.grantReadWriteData(recognizeFn);
    attendanceTable.grantReadWriteData(adminQueryFn);
    attendanceTable.grantReadWriteData(dailyCloseoutFn);
    attendanceTable.grantReadData(weeklyAnalyticsFn);

    uploadResultsTable.grantReadData(getResultFn);
    uploadResultsTable.grantReadWriteData(recognizeFn);

    const rekognitionActions = [
      "rekognition:SearchFacesByImage",
      "rekognition:IndexFaces",
    ];
    [registerFn, recognizeFn].forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: rekognitionActions,
          resources: ["*"],
        }),
      );
    });

    dataKey.grantEncryptDecrypt(presignFn);
    dataKey.grantEncryptDecrypt(getResultFn);
    dataKey.grantEncryptDecrypt(registerFn);
    dataKey.grantEncryptDecrypt(recognizeFn);
    dataKey.grantEncryptDecrypt(adminQueryFn);
    dataKey.grantEncryptDecrypt(dailyCloseoutFn);
    dataKey.grantEncryptDecrypt(weeklyAnalyticsFn);
    dataKey.grantEncryptDecrypt(rawCleanupFn);

    // Grant Cognito permissions to register-employee Lambda
    registerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminAddUserToGroup",
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    rawUploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(recognizeFn),
      { prefix: "raw/" },
    );

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${appName}-api`,
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
      },
    });

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      "JwtAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      },
    );

    httpApi.addRoutes({
      path: "/upload-url",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "PresignIntegration",
        presignFn,
      ),
    });
    httpApi.addRoutes({
      path: "/result/{upload_id}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "GetResultIntegration",
        getResultFn,
      ),
    });
    httpApi.addRoutes({
      path: "/checkin-upload-url",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "PresignCheckinIntegration",
        presignCheckinFn,
      ),
      // ❗ NO authorizer (public kiosk)
    });
    httpApi.addRoutes({
      path: "/admin/register-employee",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "RegisterIntegration",
        registerFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/admin/attendance",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "AdminQueryIntegration",
        adminQueryFn,
      ),
      authorizer: jwtAuthorizer,
    });

    new events.Rule(this, "DailyCloseoutRule", {
      // 23:59 IST = 18:29 UTC
      schedule: events.Schedule.cron({ minute: "29", hour: "18" }),
      targets: [new targets.LambdaFunction(dailyCloseoutFn)],
    });

    new events.Rule(this, "WeeklyAnalyticsRule", {
      // Monday 00:01 IST = Sunday 18:31 UTC
      schedule: events.Schedule.cron({
        minute: "31",
        hour: "18",
        weekDay: "SUN",
      }),
      targets: [new targets.LambdaFunction(weeklyAnalyticsFn)],
    });

    new events.Rule(this, "RawCleanupRule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(rawCleanupFn)],
    });

    const distribution = new cloudfront.Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    new s3deploy.BucketDeployment(this, "DeployWeb", {
      destinationBucket: webBucket,
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "web"))],
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "ApiBaseUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "WebUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "RekognitionCollectionId", {
      value: `${appName}-faces`,
    });
  }

  private createFn(
    id: string,
    codePath: string,
    environment: Record<string, string>,
    runtime: lambda.Runtime,
    deadLetterQueue?: sqs.IQueue,
  ): lambda.Function {
    const serviceName = path.basename(codePath);

    return new lambda.Function(this, id, {
      runtime,
      handler: `${serviceName}/index.handler`,
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "services")),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment,
      deadLetterQueue,
      retryAttempts: 1,
    });
  }
}
