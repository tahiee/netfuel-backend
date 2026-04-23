import { Router } from "express";
import { isAuthenticated, isAdmin } from "@/middlewares/auth-middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  banUser,
  unbanUser,
} from "@/controllers/user";
import {
  createUserBodySchema,
  updateUserBodySchema,
  listUsersQuerySchema,
  banUserBodySchema,
} from "@/validations/user.validation";

const router = Router();

// All user-admin routes require an authenticated admin / super-admin
router.use(isAuthenticated, isAdmin);

// Collection
router.get("/", validate(listUsersQuerySchema, "query"), listUsers);
router.post("/", validate(createUserBodySchema), createUser);

// Single user
router.get("/:id", getUserById);
router.patch("/:id", validate(updateUserBodySchema), updateUser);
router.delete("/:id", deleteUser);

// Ban / unban
router.post("/:id/ban", validate(banUserBodySchema), banUser);
router.post("/:id/unban", unbanUser);

export default router;
