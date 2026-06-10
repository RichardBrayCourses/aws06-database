# Lesson 05 - Artwork Filtering

This lesson makes uploaded artwork database-backed so the gallery can show metadata and support search.

The main changes are:

- uploaded artwork metadata is saved in the `images` table
- public gallery data is read from RDS instead of listing S3 objects directly
- gallery search matches artwork title, description, and author nickname
- gallery cards show the author nickname
- logged-in uploads now ask for a title and optional description
- users can view their profile and update their nickname

The API test script and bulk image upload script are intentionally unchanged from lesson 04. They do not yet understand the new upload metadata requirements. Lesson 06 updates those commands.

## Run

From this folder:

```bash
pnpm install
pnpm run deploy-everything
```

After deployment:

```bash
pnpm run api:test
pnpm run api:bulk-image-upload
pnpm run ui:url
```

At this point, the test and bulk upload commands still represent the lesson 04 behaviour. The next lesson fixes them for the database-backed artwork flow.

## Expected Behaviour

- Registering a new Cognito user still creates a `registered_user` row through the post-registration Lambda.
- Logged-in users can upload artwork with a title and description.
- Uploaded artwork is searchable by title, description, or author nickname.
- Users can update their nickname on the profile page.

## Useful Commands

Reset and rebuild the database:

```bash
pnpm run database:reset
pnpm run database:migrate
```

Deploy only the API:

```bash
pnpm run cdk:deploy:api
```

Destroy everything:

```bash
pnpm run destroy-everything
```
