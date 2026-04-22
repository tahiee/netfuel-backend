import { auth } from "@/libs/auth";
import { Request } from "express";

export const getSession = (req: Request) =>
  auth.api.getSession({ headers: new Headers(req.headers as any) });
