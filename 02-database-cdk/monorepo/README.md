# Lesson 02 - Database CDK

This lesson adds an Aurora PostgreSQL Serverless v2 RDS stack to the existing full-stack application.

The RDS stack creates:

- a public development VPC for the database
- an Aurora PostgreSQL Serverless v2 cluster
- a generated Secrets Manager credential
- the SSM parameter `/rds/secret-arn`, which later scripts use to find the database credentials

No database schema is created in this lesson.

## Run

From this folder:

```bash
pnpm install
pnpm run deploy-everything
```

This deploys the website, Cognito, image bucket, RDS, API, and UI.

To deploy only the database stack:

```bash
pnpm run cdk:deploy:rds
```

To destroy everything:

```bash
pnpm run destroy-everything
```

To destroy only the database stack:

```bash
pnpm run cdk:destroy:rds
```

## Useful Checks

Get the database secret ARN:

```bash
aws ssm get-parameter --name /rds/secret-arn --query "Parameter.Value" --output text
```

Read the generated database connection details:

```bash
SECRET_ARN=$(aws ssm get-parameter --name /rds/secret-arn --query "Parameter.Value" --output text)
aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query "SecretString" --output text
```
