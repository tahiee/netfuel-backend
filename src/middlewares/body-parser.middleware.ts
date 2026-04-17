import express from "express";
import type { RequestHandler } from "express";

export const jsonBody: RequestHandler = express.json({ limit: "10mb" });
export const urlEncodedBody: RequestHandler = express.urlencoded({
  limit: "10mb",
  extended: true,
});
