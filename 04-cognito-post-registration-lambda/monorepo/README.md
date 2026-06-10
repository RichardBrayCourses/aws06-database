# Lesson 04 - Cognito Post-Registration Lambda

This lesson connects Cognito registration to the database.

When a new user confirms registration in Cognito, a post-confirmation Lambda runs and inserts a row into `registered_user`.

The Lambda:

- reads `/rds/secret-arn` from SSM
- reads database credentials from Secrets Manager
- connects to the `uptickart` database
- inserts the Cognito `sub` and `email` into `registered_user`

## Run

From this folder:

```bash
pnpm install
pnpm run deploy-everything
```

After deployment:

1. Open the CloudFront UI.
2. Register a new Cognito user.
3. Confirm the user.
4. Check the database table:

```sql
SELECT sub, email, nickname FROM registered_user;
```

You should see the new Cognito user in the database.

## Useful Commands

Run migrations only:

```bash
pnpm run database:migrate
```

Reset and recreate the schema:

```bash
pnpm run database:reset
pnpm run database:migrate
```

Deploy only Cognito and the post-confirmation Lambda:

```bash
pnpm run cdk:deploy:cognito
```

Run API checks:

```bash
pnpm run api:test
```

Destroy everything:

```bash
pnpm run destroy-everything
```

## Code Changes In This Lesson

This lesson connects Cognito sign-up to the database. The important change is a new post-confirmation Lambda that runs after a Cognito user confirms their account.

The Lambda implementation lives in `cdk/src/lambdas/postConfirmation.ts`. It receives a Cognito post-confirmation event and reads the user's `sub` and `email` from the event:

```ts
export const handler = async (
  event: PostConfirmationTriggerEvent,
): Promise<PostConfirmationTriggerEvent> => {
  const sub = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
```

The Lambda needs database credentials. It reads `/rds/secret-arn` from SSM, then uses that ARN to read the generated RDS secret from Secrets Manager:

```ts
const parameterResponse = await ssmClient.send(
  new GetParameterCommand({ Name: "/rds/secret-arn" }),
);
const secretArn = parameterResponse.Parameter?.Value;

const secretResponse = await secretsClient.send(
  new GetSecretValueCommand({ SecretId: secretArn }),
);
```

Once it has the credentials, it connects to the `uptickart` database using `pg`:

```ts
const client = new Client({
  host: credentials.host,
  port: credentials.port ?? 5432,
  database: databaseName,
  user: credentials.username,
  password: credentials.password,
  ssl: { rejectUnauthorized: false },
});
```

The insert is idempotent. If the same Cognito user is processed more than once, the database ignores the duplicate `sub`:

```ts
await client.query(
  `INSERT INTO registered_user (sub, email)
   VALUES ($1, $2)
   ON CONFLICT (sub) DO NOTHING`,
  [sub, email],
);
```

The CDK code for this Lambda lives in `cdk/src/lib/cognitoPostConfirmationStack.ts`. It bundles the Lambda with the database and AWS SDK dependencies it needs:

```ts
this.lambda = new NodejsFunction(this, "PostConfirmationFunction", {
  entry: join(__dirname, "..", "lambdas", "postConfirmation.ts"),
  handler: "handler",
  runtime: Runtime.NODEJS_24_X,
  timeout: Duration.seconds(30),
  environment: {
    CDK_DATABASE_NAME: props.databaseName,
  },
  bundling: {
    nodeModules: [
      "pg",
      "@aws-sdk/client-secrets-manager",
      "@aws-sdk/client-ssm",
    ],
  },
});
```

The Lambda also gets IAM permissions to read the SSM parameter and the database secret:

```ts
this.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: [
      `arn:aws:ssm:${this.region}:${this.account}:parameter/rds/*`,
    ],
  }),
);
```

Finally, the Cognito stack is updated so the user pool calls this Lambda after a user confirms registration. The result is that a new Cognito account automatically gets a matching row in `registered_user`.
