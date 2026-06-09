import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { Client } from "pg";
import { getParameter } from "./lib/ssm";

type DbCredentials = {
  username: string;
  password: string;
  host: string;
  port?: number;
};

const DEFAULT_DATABASE_NAME = "uptickart";
const FLYWAY_RETRIES = 2;

const secretsClient = new SecretsManagerClient({});

function getDatabaseName() {
  const databaseName = process.env.CDK_DATABASE_NAME ?? DEFAULT_DATABASE_NAME;

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
    throw new Error(
      "CDK_DATABASE_NAME must be a PostgreSQL identifier using letters, numbers, or underscores.",
    );
  }

  return databaseName;
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

async function ensureDatabase(databaseName: string, credentials: DbCredentials) {
  const adminClient = new Client({
    host: credentials.host,
    port: credentials.port ?? 5432,
    database: "postgres",
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: false },
  });

  await adminClient.connect();

  try {
    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (result.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function main() {
  const reset = process.argv.slice(2).includes("reset");
  const databaseName = getDatabaseName();

  if (process.env.PROFILE) {
    process.env.AWS_PROFILE = process.env.PROFILE;
  }

  const credentials = await getRdsCredentials();
  await ensureDatabase(databaseName, credentials);

  const rootDir = join(__dirname, "..", "..");
  const sqlDir = join(rootDir, "database", "sql");
  const flywayCommand = reset ? "clean" : "migrate";
  const cleanDisabledFlag = reset ? "-cleanDisabled=false" : "";
  const jdbcUrl = `jdbc:postgresql://${credentials.host}:${credentials.port ?? 5432}/${databaseName}?sslmode=require`;

  execSync(
    `flyway -connectRetries=${FLYWAY_RETRIES} -url="${jdbcUrl}" -user="${credentials.username}" -password="${credentials.password}" -locations="filesystem:${sqlDir}" ${cleanDisabledFlag} ${flywayCommand}`.trim(),
    { stdio: "inherit", cwd: rootDir },
  );

  console.log(`Flyway ${flywayCommand} complete.`);
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
