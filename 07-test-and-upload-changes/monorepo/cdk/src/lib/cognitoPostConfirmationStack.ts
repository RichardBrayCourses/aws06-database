import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import { join } from "node:path";

interface CognitoPostConfirmationStackProps extends StackProps {
  databaseName: string;
}

export class CognitoPostConfirmationStack extends Stack {
  public readonly lambda: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: CognitoPostConfirmationStackProps,
  ) {
    super(scope, id, props);

    this.lambda = new NodejsFunction(this, "PostConfirmationFunction", {
      entry: join(__dirname, "..", "lambdas", "postConfirmation.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.seconds(30),
      environment: {
        CDK_DATABASE_NAME: props.databaseName,
      },
    });

    this.lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/rds/*`,
        ],
      }),
    );

    this.lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["*"],
      }),
    );

    new CfnOutput(this, "PostConfirmationLambdaArn", {
      value: this.lambda.functionArn,
    });
  }
}
