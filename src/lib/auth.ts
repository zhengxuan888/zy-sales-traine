import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || "fallback-secret-key-change-me";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function signToken(user: AuthUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "train_auth_token";
