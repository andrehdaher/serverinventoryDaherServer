import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";
import { verifyToken } from "./jwt";

export interface CurrentUser {
  userId: string;
  username: string;
  role?: string;
}

const getStringValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

export const sanitizeFirebaseKey = (key: string) =>
  key.replace(/[.#$\/\[\]]/g, "_");

export const getUserFromToken = (token?: string): CurrentUser | null => {
  if (!token) return null;

  try {
    const payload = verifyToken(token) as JwtPayload & {
      userId?: string;
      username?: string;
      role?: string;
    };

    const username = getStringValue(payload.username || payload.userId || payload.sub);
    const userId = getStringValue(payload.userId || payload.username || payload.sub);

    if (!username && !userId) return null;

    return {
      userId: userId || username,
      username: username || userId,
      role: getStringValue(payload.role),
    };
  } catch (error) {
    return null;
  }
};

export const getCurrentUserFromRequest = (req: Request): CurrentUser | null => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const tokenUser = getUserFromToken(token);

  if (tokenUser) {
    return tokenUser;
  }

  const username = getStringValue(
    req.headers["x-inventory-username"] || req.headers["x-username"],
  );
  const userId = getStringValue(
    req.headers["x-inventory-user-id"] || req.headers["x-user-id"] || username,
  );

  if (!username && !userId) {
    return null;
  }

  return {
    userId: userId || username,
    username: username || userId,
  };
};

export const requireCurrentUser = (req: Request): CurrentUser => {
  const user = getCurrentUserFromRequest(req);

  if (!user) {
    throw new Error("USER_REQUIRED");
  }

  return user;
};
