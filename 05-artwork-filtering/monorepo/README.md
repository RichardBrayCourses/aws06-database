# Lesson 05 - Artwork Filtering

This lesson makes uploaded artwork database-backed so the gallery can show metadata and support search.

The main changes are:

- uploaded artwork metadata is saved in the `images` table
- public gallery data is read from RDS instead of listing S3 objects directly
- gallery search matches artwork title, description, and author nickname
- gallery cards show the author nickname
- logged-in uploads now ask for a title and optional description
- users can view their profile and update their nickname

Request-body handling in this lesson is deliberately minimal. The controllers pull values directly from `req.body` so the next lesson can focus on adding Zod validation as a clear incremental improvement.

The API test script and bulk image upload script are intentionally unchanged from lesson 04. They do not yet understand the new upload metadata requirements. Lesson 07 updates those commands.

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

At this point, the test and bulk upload commands still represent the lesson 04 behaviour. Lesson 07 fixes them for the database-backed artwork flow.

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

## Code Changes In This Lesson

This lesson turns the gallery from an S3 object listing into a database-backed artwork gallery. The image file still lives in S3, but the title, description, owner, and search data live in RDS.

The API now has a small database layer in `services/api/src/database`. The photo repository joins `images` to `registered_user` so gallery cards can include the uploader nickname:

```ts
const result = await client.query<PhotoRow>(
  `SELECT i.id,
          i.sub,
          i.uuid_filename,
          i.image_name,
          i.image_description,
          u.nickname AS author_nickname,
          i.created_at
     FROM images i
     LEFT JOIN registered_user u ON i.sub = u.sub
    WHERE $1 = ''
       OR i.image_name ILIKE '%' || $1 || '%'
       OR COALESCE(i.image_description, '') ILIKE '%' || $1 || '%'
       OR COALESCE(u.nickname, '') ILIKE '%' || $1 || '%'
    ORDER BY i.created_at DESC`,
  [term],
);
```

The presigned upload endpoint now expects metadata before it creates the S3 URL. In this lesson, the controller keeps the request-body handling as short as possible:

```ts
const body = req.body ?? {};
const imageName = String(body.imageName ?? "").trim();
const imageDescription = body.imageDescription
  ? String(body.imageDescription).trim()
  : null;
const contentType = String(body.contentType ?? "image/jpeg");
```

That is intentionally not robust validation. Lesson 06 replaces this simple extraction with Zod schemas.

After the API creates a UUID filename for S3, it inserts the metadata into the `images` table:

```ts
const uuidFilename = randomUUID();

await insertPhoto(client, {
  sub: auth.sub,
  uuidFilename,
  imageName,
  imageDescription,
});
```

The gallery endpoint no longer asks S3 for a list of objects. Instead, it reads database rows and uses the CloudFront URL to build image URLs:

```ts
const rows = await listPhotos(client, search);
const photoData: PhotoData[] = rows.map((photo) => {
  const encodedKey = encodeURIComponent(photo.uuid_filename);
  const url = `${cloudfrontBase}/${encodedKey}`;

  return {
    id: String(photo.id),
    title: photo.image_name,
    description: photo.image_description ?? "",
    authorNickname: photo.author_nickname,
    small: url,
    large: url,
  };
});
```

There is also a new user controller. It lets a signed-in user read their profile and update their nickname:

```ts
export async function updateCurrentUserNickname(req: Request, res: Response) {
  const auth = getAuth(req);
  const user = await updateUserNickname(client, auth.sub, nickname);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
}
```

The Express app mounts those routes after `attachAuth` and `requireAuth`, so they are only available to signed-in users:

```ts
app.use(publicRoutes);
app.use(attachAuth, requireAuth);
app.use("/photos", photoRoutes);
app.use("/users", userRoutes);
app.use("/admin", requireGroup("administrators"), administratorRoutes);
```

On the frontend, the upload page now collects the artwork title and description before sending the file:

```tsx
await uploadPhoto(
  selectedFile,
  imageName.trim(),
  imageDescription.trim() || null,
);
```

The gallery page passes the search text to the API and shows the author nickname when one is available:

```tsx
const photos = await listPhotos(searchText);

{photo.authorNickname && (
  <div className="text-white/80 text-xs">by {photo.authorNickname}</div>
)}
```

The profile page calls the new profile endpoints so users can edit the nickname that appears on gallery cards:

```tsx
const nextProfile = await updateNickname(nickname.trim() || null);
setProfile(nextProfile);
setNickname(nextProfile.nickname ?? "");
```

One important teaching detail: the old `api:test` and `api:bulk-image-upload` scripts are deliberately left in their lesson 04 state. They do not yet understand that uploads need metadata, so they are fixed in lesson 07.
