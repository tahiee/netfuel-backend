import log, { type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isRailway =
  process.env.RAILWAY_ENVIRONMENT === "production" ||
  !!process.env.RAILWAY_PROJECT_ID;

const rootLogger = log({
  level: isProduction || isRailway ? "warn" : "info",
  base: {
    pid: false,
  },
  transport:
    isProduction || isRailway
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
          },
        },
});

const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

function isMergeObjectSecondArg(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Error) return true;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  return true;
}

/**
 * Pino 9+ / 10+ expects `logger.error({ err }, "message")`.
 * This adapter keeps legacy `logger.error("message", err)` and `logger.error("message", obj)` working.
 */
function wrapLogMethod(
  target: Logger,
  level: (typeof LEVELS)[number],
): (...args: unknown[]) => void {
  const orig = target[level].bind(target) as (...args: unknown[]) => void;

  return function compatLog(first: unknown, ...rest: unknown[]): void {
    if (typeof first === "string") {
      if (rest.length === 0) {
        orig(first);
        return;
      }
      const [r0, ...rN] = rest;
      if (rN.length === 0 && isMergeObjectSecondArg(r0)) {
        if (r0 instanceof Error) {
          orig({ err: r0 }, first);
          return;
        }
        orig(r0 as object, first);
        return;
      }
      orig(first, r0, ...rN);
      return;
    }

    orig(first, ...rest);
  };
}

function wrapPinoLogger<T extends Logger>(instance: T): T {
  return new Proxy(instance, {
    get(target, prop, receiver) {
      if (prop === "child") {
        const childFn = Reflect.get(target, prop, receiver) as Logger["child"];
        return (...args: Parameters<Logger["child"]>) =>
          wrapPinoLogger(childFn.apply(target, args) as unknown as T);
      }

      if (
        prop === "fatal" ||
        prop === "error" ||
        prop === "warn" ||
        prop === "info" ||
        prop === "debug" ||
        prop === "trace"
      ) {
        return wrapLogMethod(target, prop);
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (value as (...a: unknown[]) => unknown).bind(target);
      }
      return value;
    },
  }) as T;
}

/**
 * Typed loosely on purpose: Pino 10’s `LogFn` overloads reject legacy `logger.error("msg", err)`.
 * `wrapPinoLogger` fixes those calls at runtime; this keeps the rest of the codebase unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- compatibility surface for Pino 10+ vs legacy call sites
export const logger: any = wrapPinoLogger(rootLogger);
