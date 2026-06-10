import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, parse, resolve } from "node:path";
import { createDbClient } from "./lib/database";
import { getParameter } from "./lib/ssm";

const SYSTEM_USER_SUB = "system";
const DEFAULT_DESCRIPTION = "Seed artwork";

const s3Client = new S3Client({});

function contentTypeFor(fileName: string) {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function titleFor(fileName: string) {
  return parse(fileName)
    .name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 40);
}

function keyFor(fileName: string, index: number) {
  const safeName = parse(fileName)
    .name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = `seed-${String(index + 1).padStart(2, "0")}-`;

  return `${prefix}${safeName}`.slice(0, 36);
}

async function main() {
  const bucketName = await getParameter("/images/bucket-name");
  const photosDir = resolve(process.env.PHOTOS_DIR ?? "../../photos-to-upload");
  const photoNames = (await readdir(photosDir))
    .filter((name) => !name.startsWith("."))
    .sort();

  if (photoNames.length === 0) {
    throw new Error(`No photos found in ${photosDir}.`);
  }

  const client = await createDbClient();

  try {
    await client.query(
      `INSERT INTO registered_user (sub, email, nickname)
       VALUES ($1, $2, $3)
       ON CONFLICT (sub) DO UPDATE
       SET email = EXCLUDED.email,
           nickname = EXCLUDED.nickname`,
      [SYSTEM_USER_SUB, "system@example.com", "system"],
    );

    for (const [index, photoName] of photoNames.entries()) {
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

      await client.query(
        `INSERT INTO images (sub, uuid_filename, image_name, image_description, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (uuid_filename) DO UPDATE
         SET sub = EXCLUDED.sub,
             image_name = EXCLUDED.image_name,
             image_description = EXCLUDED.image_description`,
        [SYSTEM_USER_SUB, key, title, DEFAULT_DESCRIPTION],
      );

      console.log(`Seeded ${photoName} as ${key}`);
    }

    console.log(`Seeded ${photoNames.length} image(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
