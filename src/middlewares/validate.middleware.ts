import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

/**
 * Validates `req[source]` against a Zod schema and replaces it with the
 * parsed (and type-coerced) data.
 *
 * IMPORTANT — Express 5 change: `req.query` is now a getter, so direct
 * assignment (`req.query = parsed`) throws
 *   "Cannot set property query of #<IncomingMessage> which has only a getter".
 *
 * We use `Object.defineProperty` to override the getter when the source is
 * `query`. Body and params can be assigned directly.
 */
export const validate =
  (schema: ZodSchema<any>, source: Source = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
      return;
    }

    if (source === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      (req as any)[source] = result.data;
    }

    next();
  };
