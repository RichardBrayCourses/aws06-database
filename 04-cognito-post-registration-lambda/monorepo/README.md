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
