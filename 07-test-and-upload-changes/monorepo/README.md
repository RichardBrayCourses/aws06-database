# Lesson 07 - Test And Upload Changes

This lesson builds on lesson 06 and fixes the supporting scripts for the database-backed artwork flow.

The main changes are:

- the old `api:bulk-image-upload` command is replaced with `images:init`
- `deploy-everything` now seeds artwork before deploying the API and UI
- `api:test` now checks the profile route and Zod upload validation
- `api:test` resets its Cognito test users on every run so the post-confirmation Lambda creates fresh database rows

## Run

From this folder:

```bash
pnpm install
pnpm run deploy-everything
```

`deploy-everything` now:

1. deploys the AWS stacks
2. runs Flyway migrations
3. seeds system artwork with `images:init`
4. deploys the API
5. builds and uploads the UI

After deployment:

```bash
pnpm run api:test
pnpm run ui:url
```

To refresh seed artwork without a full deploy:

```bash
pnpm run images:init
```

## Expected Behaviour

- The public gallery shows seeded system artwork.
- `pnpm run api:test` passes.

## Useful Commands

Reset and rebuild the database:

```bash
pnpm run database:reset
pnpm run database:migrate
pnpm run images:init
```

After resetting the database, delete any real Cognito users you created through the UI before testing registration again.

`database:reset` removes rows from `registered_user`, but it does not delete Cognito users. `pnpm run api:test` handles this automatically for its own test users.

Deploy only the API:

```bash
pnpm run cdk:deploy:api
```

Destroy everything:

```bash
pnpm run destroy-everything
```

## Code Changes In This Lesson

This lesson replaces the old bulk upload command with a database-aware seed script and updates the API test helper for the lesson 05 and lesson 06 API changes.

The first change is a new migration, `database/sql/V5__Create_system_user.sql`. It creates a stable user that can own seeded artwork:

```sql
INSERT INTO registered_user (sub, email, nickname)
VALUES ('system', 'system@example.com', 'system')
ON CONFLICT (sub) DO UPDATE
SET email = EXCLUDED.email,
    nickname = EXCLUDED.nickname;
```

The replacement seed script is `scripts/src/init-images.ts`. It reads the image bucket name from SSM, reads local files from `photos-to-upload`, uploads them to S3, and upserts matching rows in `images`:

```ts
const bucketName = await getParameter("/images/bucket-name");
const photosDir = resolve(process.env.PHOTOS_DIR ?? "../../photos-to-upload");
```

Before seeding images, the script upserts the `system` user so the foreign key on `images.sub` is valid:

```ts
await client.query(
  `INSERT INTO registered_user (sub, email, nickname)
   VALUES ($1, $2, $3)
   ON CONFLICT (sub) DO UPDATE
   SET email = EXCLUDED.email,
       nickname = EXCLUDED.nickname`,
  [SYSTEM_USER_SUB, "system@example.com", "system"],
);
```

Each image is uploaded to S3 and then recorded in the database:

```ts
await s3Client.send(
  new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }),
);

await client.query(
  `INSERT INTO images (sub, uuid_filename, image_name, image_description, created_at)
   VALUES ($1, $2, $3, $4, NOW())
   ON CONFLICT (uuid_filename) DO UPDATE
   SET sub = EXCLUDED.sub,
       image_name = EXCLUDED.image_name,
       image_description = EXCLUDED.image_description`,
  [SYSTEM_USER_SUB, key, title, DEFAULT_DESCRIPTION],
);
```

The root package scripts are updated so seeding is part of a full deployment:

```json
"images:init": "tsx scripts/src/init-images.ts",
"deploy-everything": "pnpm run cdk:deploy:website && pnpm run cdk:deploy:cognito && pnpm run cdk:deploy:images && pnpm run cdk:deploy:rds && pnpm run database:migrate && pnpm run images:init && pnpm run cdk:deploy:api && pnpm run ui:generate-env && pnpm run deploy-website"
```

The API test script is also updated. `scripts/src/api-test.ts` now prepares test users, gets tokens, and runs the security checks:

```ts
const apiBaseUrl = await getApiBaseUrl();
const cognitoConfig = await prepareTestUsers();

const [userToken, adminToken] = await Promise.all([
  getIdToken(cognitoConfig, regularTestUser),
  getIdToken(cognitoConfig, adminTestUser),
]);
```

It now includes checks for the profile route and for Zod validation on the upload endpoint:

```ts
{
  name: "photo upload URL validates regular user request body",
  method: "POST",
  path: "/auth/photos/presigned-url",
  token: userToken,
  expectedStatus: 400,
},
{
  name: "profile allows regular user",
  path: "/auth/users/me",
  token: userToken,
  expectedStatus: 200,
},
```

The test users live in `scripts/src/lib/testUsers.ts`:

```ts
export const regularTestUser = {
  email: "test-user@example.com",
  password: "TestUserPassword123!",
};

export const adminTestUser = {
  email: "test-admin@example.com",
  password: "TestAdminPassword123!",
  groupName: "administrators",
};
```

`prepareTestUsers()` in `scripts/src/lib/cognito.ts` resets both accounts before each test run:

```text
delete Cognito users if present
delete database rows for those emails if present
sign up Cognito users again
confirm them
verify email
add the admin user to the administrators group
wait for the post-confirmation Lambda to create fresh database rows
```

The helper is split into small steps so each Cognito action is easy to read:

```ts
for (const user of testUsers) {
  await deleteCognitoUser(config, user.email);
}

await deleteRegisteredUsersByEmail(testUsers.map((user) => user.email));

for (const user of testUsers) {
  await createTestUser(config, user);
}
```

Each test user is recreated through the normal sign-up path so the post-confirmation trigger runs:

```ts
await signUpTestUser(config, user);
await confirmTestUser(config, user.email);
await verifyTestUserEmail(config, user.email);
```

The script then waits for the matching database row before continuing:

```ts
const sub = await getCognitoSub(config, user.email);
await waitForRegisteredUserBySub(sub, user.email);
```

That makes `pnpm run api:test` a repeatable integration check for the deployed API, Cognito authorizer, Cognito groups, post-confirmation Lambda, and database-backed profile route.
