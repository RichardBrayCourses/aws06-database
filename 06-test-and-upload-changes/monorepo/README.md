# Lesson 06 - Test And Upload Changes

This lesson updates the API testing and image-loading commands for the database-backed artwork flow from lesson 05.

The main changes are:

- API tests now include the profile endpoints added in lesson 05
- the presigned URL test now expects request validation, because uploads require metadata
- Cognito test users are recreated through sign-up and confirmation so the post-confirmation Lambda inserts matching database rows
- the old API bulk upload command is replaced with a database-aware seed command
- `deploy-everything` now seeds artwork before deploying the API and UI

## Seed Artwork

Flyway migration `V5__Create_system_user.sql` creates a stable database user for seed artwork:

```text
sub = system
nickname = system
```

The seed script uploads local images to S3 and upserts database rows owned by `system`. This is not a Cognito/API upload flow; it runs locally with AWS and RDS credentials.

Run it with:

```bash
pnpm run images:init
```

There is no separate bulk upload command in this lesson. Use `images:init` whenever you want to refresh the seeded artwork.

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
```

Then open the CloudFront UI:

```bash
pnpm run ui:url
```

## Expected Behaviour

- The public gallery should show seeded system artwork.
- Searching should match title, description, or author nickname.
- Registering a new Cognito user should create a `registered_user` row through the post-registration Lambda.
- Logged-in users can upload artwork with a title and description.
- Uploaded artwork is searchable and linked to the user's nickname.

## Testing Endpoint Protection

Run the deployed API security checks with:

```bash
pnpm run api:test
```

The test script reads the deployed API and Cognito configuration from SSM, creates or reuses test users, obtains Cognito ID tokens, and calls the API through API Gateway.

It checks that:

```text
GET /public/health
  anonymous access succeeds

GET /public/gallery-photos
  anonymous access succeeds

POST /auth/photos/presigned-url
  anonymous access fails
  regular user access reaches request validation

GET /auth/users/me
  anonymous access fails
  regular user access succeeds

GET /auth/admin/member
  anonymous access fails
  regular user access fails
  administrator access succeeds

DELETE /auth/admin/photos
  regular user access fails
```

These are deployed integration checks rather than isolated Express unit tests, so they verify the API Gateway routes, Cognito authorizer, Cognito group claims, Lambda adapter, and Express route protection together.

## Useful Commands

Reset and rebuild the database:

```bash
pnpm run database:reset
pnpm run database:migrate
pnpm run images:init
```

After resetting the database, delete any existing users from the Cognito user pool in the AWS Management Console before testing registration again.

This matters because `database:reset` removes rows from `registered_user`, but it does not delete Cognito users. Existing Cognito users will not automatically run the post-registration Lambda again, so they can have valid Cognito accounts without matching database rows.

Deploy only the API:

```bash
pnpm run cdk:deploy:api
```

Run API security checks:

```bash
pnpm run api:test
```

Destroy everything:

```bash
pnpm run destroy-everything
```

## Code Changes In This Lesson

This lesson fixes the supporting scripts now that artwork uploads are database-backed. Lesson 05 changed the API shape; this lesson updates the seed data and API checks to match.

The first change is a new migration, `database/sql/V5__Create_system_user.sql`. It creates a stable user that can own seeded artwork:

```sql
INSERT INTO registered_user (sub, email, nickname)
VALUES ('system', 'system@example.com', 'system')
ON CONFLICT (sub) DO UPDATE
SET email = EXCLUDED.email,
    nickname = EXCLUDED.nickname;
```

The old bulk upload script used the protected upload API. That no longer works well for seed data because the upload flow now depends on a real Cognito user and image metadata. The replacement script is `scripts/src/init-images.ts`.

It reads the image bucket name from SSM and reads local files from `photos-to-upload`:

```ts
const bucketName = await getParameter("/images/bucket-name");
const photosDir = resolve(process.env.PHOTOS_DIR ?? "../../photos-to-upload");
const photoNames = (await readdir(photosDir))
  .filter((name) => !name.startsWith("."))
  .sort();
```

Before seeding images, the script upserts the `system` user. This mirrors the migration and makes the script safe to run repeatedly:

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

Each local image is uploaded to S3 with a stable generated key:

```ts
const key = keyFor(photoName, index);
const title = titleFor(photoName);
const contentType = contentTypeFor(photoName);
const body = await readFile(join(photosDir, photoName));

await s3Client.send(
  new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }),
);
```

The script then upserts the matching row in `images`. This is the database-backed part of the seed process:

```ts
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

The API test script is also updated. It now checks the profile endpoints and expects the metadata-aware upload endpoint to reject an incomplete regular-user request:

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

Finally, the Cognito test-user helper changes how it creates test accounts. Instead of only creating users administratively, it deletes and signs them up again so the post-confirmation trigger runs and creates matching `registered_user` rows:

```ts
await cognitoClient.send(
  new SignUpCommand({
    ClientId: clientId,
    Username: user.email,
    Password: user.password,
    UserAttributes: [{ Name: "email", Value: user.email }],
  }),
);

await cognitoClient.send(
  new AdminConfirmSignUpCommand({
    UserPoolId: userPoolId,
    Username: user.email,
  }),
);
```

That means `pnpm run api:test` now exercises the deployed API, the Cognito authorizer, the Cognito groups, the post-confirmation Lambda, and the database-backed profile route together.
