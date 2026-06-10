import type { Client } from "pg";

export type PhotoRow = {
  id: number;
  sub: string;
  uuid_filename: string;
  image_name: string;
  image_description: string | null;
  author_nickname: string | null;
  created_at: string;
};

export async function listPhotos(client: Client, search: string) {
  const term = search.trim();
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

  return result.rows;
}

export async function insertPhoto(
  client: Client,
  photo: {
    sub: string;
    uuidFilename: string;
    imageName: string;
    imageDescription: string | null;
  },
) {
  const result = await client.query<PhotoRow>(
    `INSERT INTO images (sub, uuid_filename, image_name, image_description, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, sub, uuid_filename, image_name, image_description, NULL AS author_nickname, created_at`,
    [
      photo.sub,
      photo.uuidFilename,
      photo.imageName,
      photo.imageDescription,
    ],
  );

  return result.rows[0];
}

export async function deleteAllPhotos(client: Client) {
  const result = await client.query("DELETE FROM images");
  return result.rowCount ?? 0;
}
