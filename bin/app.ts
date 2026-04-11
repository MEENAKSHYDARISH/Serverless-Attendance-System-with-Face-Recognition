#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AttendanceStack } from '../lib/attendance-stack';

const app = new cdk.App();
const envName = (app.node.tryGetContext('env') as string) ?? 'dev';
const region = (app.node.tryGetContext('region') as string) ?? 'ap-south-1';

new AttendanceStack(app, `AttendanceStack-${envName}`, {
  envName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region,
  },
});
