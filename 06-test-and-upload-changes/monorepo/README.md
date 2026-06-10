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
