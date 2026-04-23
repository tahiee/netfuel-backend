import { auth } from "@/libs/auth";

/**
 * Hash a plaintext password using better-auth's built-in hasher (scrypt-based).
 *
 * You MUST use this instead of bcrypt when inserting `account.password` rows —
 * better-auth's `verifyPassword` rejects any hash that wasn't produced by its
 * own algorithm ("Invalid password hash" at sign-in).
 *
 * `auth.$context` is a promise that resolves to better-auth's internal context,
 * which exposes the password hasher used by the signup/signin endpoints.
 */
export async function hashPassword(plain: string): Promise<string> {
  const ctx = await auth.$context;
  return ctx.password.hash(plain);
}

/**
 * Verify a plaintext password against a stored hash.
 * Mirrors the hasher above — use when you need to check passwords server-side
 * (e.g., admin-initiated password changes or audits).
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  const ctx = await auth.$context;
  return ctx.password.verify({ password: plain, hash });
}
