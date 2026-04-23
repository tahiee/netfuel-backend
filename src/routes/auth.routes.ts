import { Router, Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/libs/auth";

const router = Router();

/**
 * Mount better-auth's full API surface under `/api/auth/*`.
 * Handles sign-in, sign-up, sign-out, 2FA, email OTP, password reset,
 * admin plugin endpoints (ban/unban/list-users/etc.), and session reads.
 *
 * Express 5 + path-to-regexp v8 require NAMED wildcards (`*splat`) instead of
 * the old `*`. Without a name, `pathToRegexp` throws "Missing parameter name".
 *
 * Note: better-auth parses its own request bodies — mount this BEFORE the
 * express json/urlencoded body parsers so they don't consume the stream.
 */
router.all("/*splat", (req: Request, res: Response) => {
  return toNodeHandler(auth)(req, res);
});

export default router;
