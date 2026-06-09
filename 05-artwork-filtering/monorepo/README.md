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

## Endpoints And Their Protections

The deployed API is split into two API Gateway zones:

```text
/public/{proxy+}
  Anonymous access allowed

/auth/{proxy+}
  Cognito authentication required
```

The Express app is mounted behind both zones. The Lambda adapter passes only the proxy part of the path to Express, so deployed `GET /public/health` is handled by the Express `/health` route, and deployed `GET /auth/users/me` is handled by the Express `/users/me` route.

Current endpoints:

```text
GET    /public/health
GET    /public/gallery-photos
POST   /auth/photos/presigned-url
GET    /auth/users/me
PUT    /auth/users/me/nickname
GET    /auth/admin/member
DELETE /auth/admin/photos
```

Protection summary:

```text
Public:
GET /public/health
GET /public/gallery-photos

Any signed-in Cognito user:
POST /auth/photos/presigned-url
GET /auth/users/me
PUT /auth/users/me/nickname

Signed-in Cognito user in the administrators group:
GET /auth/admin/member
DELETE /auth/admin/photos
```

API Gateway rejects unauthenticated calls to `/auth/*` before they reach Lambda. Express then uses `attachAuth` and `requireAuth` as an application-level guard for the protected routes, and `requireGroup("administrators")` adds the administrator-only check for `/auth/admin/*`.

`requireAuth` is not attached to each route individually. It is installed globally in `services/api/src/app.ts`, and the order of the Express middleware is what decides which routes it protects:

```ts
app.use(publicRoutes);
app.use(attachAuth, requireAuth);
app.use("/photos", photoRoutes);
app.use("/users", userRoutes);
app.use("/admin", requireGroup("administrators"), administratorRoutes);
```

That means:

- `publicRoutes` runs before `requireAuth`, so `/health` and `/gallery-photos` remain public.
- `attachAuth` and `requireAuth` run before the protected route groups, so every route mounted after them requires `req.auth`.
- `/photos` and `/users` are available to any signed-in Cognito user.
- `/admin` requires a signed-in Cognito user and the `administrators` Cognito group.

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
