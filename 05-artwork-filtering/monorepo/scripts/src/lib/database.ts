import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Client } from "pg";
import { getParameter } from "./ssm";

type DbCredentials = {
  username: string;
  password: string;
  host: string;
  port?: number;
};

const DEFAULT_DATABASE_NAME = "uptickart";
const secretsClient = new SecretsManagerClient({});

function getDatabaseName() {
  return process.env.CDK_DATABASE_NAME ?? DEFAULT_DATABASE_NAME;
}

async function getRdsCredentials() {
  const secretArn = await getParameter("/rds/secret-arn");
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!secretValue.SecretString) {
    throw new Error("RDS credentials secret did not contain a SecretString.");
  }

  return JSON.parse(secretValue.SecretString) as DbCredentials;
}

export async function createDbClient() {
  const credentials = await getRdsCredentials();
  const client = new Client({
    host: credentials.host,
    port: credentials.port ?? 5432,
    database: getDatabaseName(),
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  return client;
}
