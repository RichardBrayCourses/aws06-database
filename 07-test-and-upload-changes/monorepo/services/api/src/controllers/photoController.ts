import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { GetPhotosResponse, PhotoData } from "../types";
import { createDbClient } from "../database/db";
import {
  deleteAllPhotos,
  insertPhoto,
  listPhotos,
} from "../database/photoRepository";
import type { AuthUser } from "../middleware/auth";

export async function getPresignedUrl(req: Request, res: Response) {
  try {
    const bucketName = getBucketName(res);
    if (!bucketName) return;

    const auth = (req as any).auth as AuthUser;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { imageName, imageDescription, contentType } =
      uploadBodySchema.parse(body);
    const uuidFilename = randomUUID();

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: uuidFilename,
        ContentType: contentType,
      }),
      { expiresIn: 900 },
    );

    const client = await createDbClient();

    try {
      await insertPhoto(client, {
        sub: auth.sub,
        uuidFilename,
        imageName,
        imageDescription,
      });
    } finally {
      await client.end();
    }

    res.json({ uploadUrl, uuidFilename });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: getZodErrorMessage(error, "Invalid upload details.") });
      return;
    }

    res.status(500).json({ error: "Could not create upload URL" });
  }
}

export async function getPhotos(req: Request, res: Response) {
  const cloudfrontUrl = process.env.IMAGES_CLOUDFRONT_URL;

  if (!cloudfrontUrl) {
    res.status(500).json({ error: "Photo service is not configured." });
    return;
  }

  let client: Awaited<ReturnType<typeof createDbClient>> | undefined;

  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const cloudfrontBase = removeTrailingSlash(cloudfrontUrl);
    client = await createDbClient();
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

    const body: GetPhotosResponse = { photoData };
    res.json(body);
  } catch {
    res.status(500).json({ error: "Could not list photos." });
  } finally {
    await client?.end();
  }
}

export async function deletePhotos(_req: Request, res: Response) {
  try {
    const bucketName = getBucketName(res);
    if (!bucketName) return;

    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        }),
      );

      const photosToDelete: { Key: string }[] = [];

      for (const s3File of response.Contents ?? []) {
        if (!s3File.Key) continue;
        photosToDelete.push({ Key: s3File.Key });
      }

      if (photosToDelete.length > 0) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: photosToDelete },
          }),
        );
      }

      deleted += photosToDelete.length;
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    const client = await createDbClient();

    try {
      await deleteAllPhotos(client);
    } finally {
      await client.end();
    }

    res.json({ deleted });
  } catch {
    res.status(500).json({ error: "Could not delete photos" });
  }
}

const s3Client = new S3Client();

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
  // .catch() is a simple way to provide a fallback when parsing fails.
  contentType: z.string().startsWith("image/").catch("image/jpeg"),
});

function getBucketName(res: Response): string | null {
  const bucketName = process.env.IMAGES_BUCKET_NAME;

  if (!bucketName) {
    res.status(500).json({ error: "IMAGES_BUCKET_NAME is not configured" });
    return null;
  }

  return bucketName;
}

function removeTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

function getZodErrorMessage(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback;
}
