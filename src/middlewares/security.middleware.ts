import helmet from "helmet";
import type { RequestHandler } from "express";

/**
 * Security headers via helmet.
 *
 * We relax the default CSP to allow inline `<script>` / `<style>` / event
 * attributes, because the backend serves a small HTML status dashboard at `/`
 * that uses inline JS to poll the health endpoint. JSON API responses aren't
 * affected by CSP, so this doesn't weaken the /api/* surface.
 *
 * If you later replace the inline script with an external one (see
 * `public/status.js`), you can drop `'unsafe-inline'` from `script-src`.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https:"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"],
    },
  },
});
