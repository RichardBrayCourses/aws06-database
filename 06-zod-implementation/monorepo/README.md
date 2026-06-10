# Lesson 06 - Zod Implementation

This lesson builds on lesson 05 by replacing the shortest-possible request-body extraction with small Zod schemas.

The application behaviour is otherwise the same as lesson 05:

- uploaded artwork metadata is saved in the `images` table
- public gallery data is read from RDS
- gallery search matches artwork title, description, and author nickname
- gallery cards show the author nickname
- logged-in uploads ask for a title and optional description
- users can view their profile and update their nickname

The API test script and bulk image upload script are still intentionally unchanged from lesson 04. Lesson 07 updates those commands for the database-backed artwork flow.

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

At this point, the test and bulk upload commands still represent the lesson 04 behaviour. Lesson 07 fixes them.

## Expected Behaviour

- Registering a new Cognito user still creates a `registered_user` row through the post-registration Lambda.
- Logged-in users can upload artwork with a title and description.
- Uploaded artwork is searchable by title, description, or author nickname.
- Users can update their nickname on the profile page.
- Invalid upload/profile request bodies now receive a `400` response from Zod validation.

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

## Code Changes In This Lesson

Lesson 05 used plain extraction from `req.body`:

```ts
const body = req.body ?? {};
const imageName = String(body.imageName ?? "").trim();
```

This lesson adds `zod` to the API package and moves that request-body shaping into schemas.

The nickname endpoint now uses a small schema in `services/api/src/controllers/userController.ts`:

```ts
const updateNicknameSchema = z.object({
  nickname: z
    .string({ error: "Nickname must be a string or null." })
    .trim()
    .max(20, "Nickname must be 20 characters or less.")
    .nullable()
    .optional()
    .transform((nickname) => nickname || null),
});
```

The route handler parses the incoming body before updating the database:

```ts
const body = req.body ?? {};
const nickname = updateNicknameSchema.parse(body).nickname;
```

The upload endpoint uses a slightly larger schema in `services/api/src/controllers/photoController.ts`:

```ts
const uploadBodySchema = z.object({
  imageName: z
    .string({ error: "Image title is required." })
    .trim()
    .min(1, "Image title is required.")
    .max(40, "Image title must be 40 characters or less."),
  imageDescription: z
    .preprocess(
      (value) => (value === undefined ? null : value),
      z
        .string({ error: "Image description must be a string or null." })
        .trim()
        .max(120, "Image description must be 120 characters or less.")
        .nullable(),
    )
    .transform((description) => description || null),
  contentType: z.string().startsWith("image/").catch("image/jpeg"),
});
```

This is intentionally a tutorial-sized Zod example rather than a complete validation framework. It shows:

- `z.object(...)` for request bodies
- `z.string(...)` for type checks
- `.trim()`, `.min(...)`, and `.max(...)` for string rules
- `.nullable()` and `.optional()` for values the API allows to be absent
- `.transform(...)` for shaping valid input into the value the app wants
- `z.preprocess(...)` for converting `undefined` to `null`
- `.catch(...)` for a simple fallback content type

Zod errors are turned into `400` responses:

```ts
if (error instanceof z.ZodError) {
  res
    .status(400)
    .json({ error: getZodErrorMessage(error, "Invalid upload details.") });
  return;
}
```

The next lesson keeps these Zod schemas and updates the testing and seed-image scripts around the database-backed artwork flow.
