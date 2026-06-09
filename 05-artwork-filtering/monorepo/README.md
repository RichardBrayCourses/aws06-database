# Lesson 05 - Artwork Filtering

This lesson makes the gallery database-backed.

The app now stores and searches artwork metadata in RDS:

- registered user profile data lives in `registered_user`
- uploaded artwork metadata lives in `images`
- public gallery reads from the database
- search matches artwork title, description, and author nickname
- gallery cards show the author nickname
- real user uploads still use protected Cognito routes

This lesson also adds stable seed artwork through a local seed script.

## Seed Artwork

Flyway migration `V5__Create_system_user.sql` creates a stable database user:

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
