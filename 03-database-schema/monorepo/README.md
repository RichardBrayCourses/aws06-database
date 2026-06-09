# Lesson 03 - Database Schema

This lesson adds Flyway database migrations to the RDS-backed application.

The schema creates:

- `registered_user`
- `nickname` on `registered_user`
- `images`
- indexes for gallery search by title, description, and nickname

The application functionality is otherwise unchanged in this lesson.

## Run

From this folder:

```bash
pnpm install
pnpm run deploy-everything
```

`deploy-everything` deploys RDS, runs Flyway migrations, deploys the API, and publishes the UI.

To migrate the database independently:

```bash
pnpm run database:migrate
```

To reset and then recreate the schema:

```bash
pnpm run database:reset
pnpm run database:migrate
```

To destroy everything:

```bash
pnpm run destroy-everything
```

## Connecting With pgAdmin

Read the RDS credentials from Secrets Manager:

```bash
SECRET_ARN=$(aws ssm get-parameter --name /rds/secret-arn --query "Parameter.Value" --output text)
aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query "SecretString" --output text
```

Use the returned `host`, `port`, `username`, and `password` in pgAdmin.

The database name is:

```text
uptickart
```
