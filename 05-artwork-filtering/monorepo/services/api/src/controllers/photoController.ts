import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { GetPhotosResponse, PhotoData } from "../types";
import { createDbClient } from "../database/db";
import {
  deleteAllPhotos,
  insertPhoto,
  listPhotos,
} from "../database/photoRepository";
import type { AuthUser } from "../middleware/auth";

const s3Client = new S3Client();

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

function normaliseUploadBody(body: unknown) {
  const payload = (body && typeof body === "object" ? body : {}) as {
    imageName?: unknown;
    imageDescription?: unknown;
    contentType?: unknown;
  };

  if (typeof payload.imageName !== "string") {
    throw new Error("Image title is required.");
  }

  const imageName = payload.imageName.trim();
  if (!imageName) throw new Error("Image title is required.");
  if (imageName.length > 40) {
    throw new Error("Image title must be 40 characters or less.");
  }

  let imageDescription: string | null = null;
  if (typeof payload.imageDescription === "string") {
    imageDescription = payload.imageDescription.trim() || null;
  } else if (payload.imageDescription !== null && payload.imageDescription !== undefined) {
    throw new Error("Image description must be a string or null.");
  }

  if (imageDescription && imageDescription.length > 120) {
    throw new Error("Image description must be 120 characters or less.");
  }

  const contentType =
    typeof payload.contentType === "string" && payload.contentType.startsWith("image/")
      ? payload.contentType
      : "image/jpeg";

  return { imageName, imageDescription, contentType };
}

export async function getPresignedUrl(req: Request, res: Response) {
  try {
    const bucketName = getBucketName(res);
    if (!bucketName) return;

    const auth = (req as any).auth as AuthUser;
    const { imageName, imageDescription, contentType } = normaliseUploadBody(
      req.body,
    );
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
    if (error instanceof Error && error.message.startsWith("Image ")) {
      res.status(400).json({ error: error.message });
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
