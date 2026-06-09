import type { Request, Response } from "express";
import { createDbClient } from "../database/db";
import { getUserBySub, updateUserNickname } from "../database/userRepository";
import type { AuthUser } from "../middleware/auth";

function getAuth(req: Request) {
  return (req as any).auth as AuthUser;
}

function normaliseNickname(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Nickname must be a string or null.");
  }

  const nickname = value.trim();
  if (!nickname) return null;
  if (nickname.length > 20) {
    throw new Error("Nickname must be 20 characters or less.");
  }

  return nickname;
}

export async function getCurrentUser(req: Request, res: Response) {
  const auth = getAuth(req);
  let client: Awaited<ReturnType<typeof createDbClient>> | undefined;

  try {
    client = await createDbClient();
    const user = await getUserBySub(client, auth.sub);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch {
    res.status(500).json({ error: "Could not read user profile." });
  } finally {
    await client?.end();
  }
}

export async function updateCurrentUserNickname(req: Request, res: Response) {
  let nickname: string | null;

  try {
    nickname = normaliseNickname(req.body?.nickname);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid nickname.",
    });
    return;
  }

  const auth = getAuth(req);
  let client: Awaited<ReturnType<typeof createDbClient>> | undefined;

  try {
    client = await createDbClient();
    const user = await updateUserNickname(client, auth.sub, nickname);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch {
    res.status(500).json({ error: "Could not update user profile." });
  } finally {
    await client?.end();
  }
}
