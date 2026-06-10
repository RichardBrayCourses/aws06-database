# AWS 06 - Database Implementation

This section extends the full-stack application with a PostgreSQL database. You deploy Aurora RDS, version the schema with Flyway, connect Cognito registration to the database, and build a database-backed artwork gallery with search, profile data, and deployed integration tests.

Each lesson is a self-contained copy of the monorepo in its own folder. Work through the lessons in order. Each lesson README explains what changed in that step and how to run it.

## Lessons

| Lesson | Folder | What you add |
| --- | --- | --- |
| 01 | `01-install-flyway-and-pgadmin-scripts` | Flyway and pgAdmin on your machine |
| 02 | `02-database-cdk` | Aurora PostgreSQL Serverless v2 RDS stack |
| 03 | `03-database-schema` | Flyway migrations for `registered_user` and `images` |
| 04 | `04-cognito-post-registration-lambda` | Post-confirmation Lambda that inserts new users into RDS |
| 05 | `05-artwork-filtering` | Database-backed gallery, search, uploads, and profile routes |
| 06 | `06-zod-implementation` | Zod validation for upload and profile request bodies |
| 07 | `07-test-and-upload-changes` | Seed artwork script and updated `api:test` helper |

## Getting Started

1. Open lesson 01 and follow its README to install Flyway and pgAdmin.
2. Move into that lesson's `monorepo` folder.
3. Run `pnpm install` and `pnpm run deploy-everything` when the lesson README tells you to.
4. Continue through lessons 02 to 07 in order.

Lesson 01 install instructions:

```text
01-install-flyway-and-pgadmin-scripts/monorepo/README.md
```

From lesson 02 onward, the usual workflow inside each lesson's `monorepo` folder is:

```bash
pnpm install
pnpm run deploy-everything
```

Lesson 07 also expects:

```bash
pnpm run api:test
pnpm run ui:url
```

## API Endpoint Reference

From lesson 05 onward, the deployed API is split into two API Gateway zones:

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

## API Protection Tests

From lesson 07, run the deployed API security checks from that lesson's `monorepo` folder with:

```bash
pnpm run api:test
```

The test script reads the deployed API and Cognito configuration from SSM, resets two test users, obtains Cognito ID tokens, and calls the API through API Gateway.

Before each run, it:

```text
deletes Cognito users test-user@example.com and test-admin@example.com if present
deletes matching database rows if present
signs the users up again through the normal Cognito flow
waits for the post-confirmation Lambda to create fresh database rows
gets tokens
runs the security checks
```

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

These are deployed integration checks rather than isolated Express unit tests. They verify the API Gateway routes, Cognito authorizer, Cognito group claims, post-confirmation Lambda, Lambda adapter, and Express route protection together.

For lesson-specific details about seed artwork, script changes, and the full test flow, see:

```text
07-test-and-upload-changes/monorepo/README.md
```
