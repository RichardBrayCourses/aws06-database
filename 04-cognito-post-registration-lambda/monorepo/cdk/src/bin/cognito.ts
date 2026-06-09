#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CognitoPostConfirmationStack } from "../lib/cognitoPostConfirmationStack.js";
import { CognitoStack } from "../lib/cognitoStack.js";

const app = new cdk.App();

const databaseName = process.env.CDK_DATABASE_NAME ?? "uptickart";

const postConfirmationStack = new CognitoPostConfirmationStack(
  app,
  "cognito-post-confirmation-stack",
  {
    databaseName,
  },
);

const cognitoStack = new CognitoStack(app, "cognito-stack", {
  postConfirmationLambda: postConfirmationStack.lambda,
});

cognitoStack.addDependency(postConfirmationStack);
