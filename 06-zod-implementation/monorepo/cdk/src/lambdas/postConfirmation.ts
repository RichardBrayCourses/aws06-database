import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { PostConfirmationTriggerEvent } from "aws-lambda";
import { Client } from "pg";

type DbCredentials = {
  username: string;
  password: string;
  host: string;
  port?: number;
};

const secretsClient = new SecretsManagerClient({});
const ssmClient = new SSMClient({});

async function getRdsCredentials() {
  const parameterResponse = await ssmClient.send(
    new GetParameterCommand({ Name: "/rds/secret-arn" }),
  );
  const secretArn = parameterResponse.Parameter?.Value;

  if (!secretArn) {
    throw new Error("SSM parameter /rds/secret-arn did not contain a value.");
  }

  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!secretResponse.SecretString) {
    throw new Error("RDS credentials secret did not contain a SecretString.");
  }

  return JSON.parse(secretResponse.SecretString) as DbCredentials;
}

async function insertUser(sub: string, email: string) {
  const databaseName = process.env.CDK_DATABASE_NAME;
  if (!databaseName) {
    throw new Error("CDK_DATABASE_NAME environment variable is not set.");
  }

  const credentials = await getRdsCredentials();
  const client = new Client({
    host: credentials.host,
    port: credentials.port ?? 5432,
    database: databaseName,
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(
      `INSERT INTO registered_user (sub, email)
       VALUES ($1, $2)
       ON CONFLICT (sub) DO NOTHING`,
      [sub, email],
    );
  } finally {
    await client.end();
  }
}

export const handler = async (
  event: PostConfirmationTriggerEvent,
): Promise<PostConfirmationTriggerEvent> => {
  const sub = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  if (!sub || !email) {
    console.warn("Cognito post-confirmation event did not include sub and email.");
    return event;
  }

  try {
    await insertUser(sub, email);
  } catch (error) {
    console.error("Could not insert registered user.", error);
  }

  return event;
};
