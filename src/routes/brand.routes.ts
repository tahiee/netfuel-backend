import { Router } from "express";
import { isAuthenticated } from "@/middlewares/auth-middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  createBrand,
  listBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} from "@/controllers/brand";
import {
  createBrandBodySchema,
  updateBrandBodySchema,
  listBrandsQuerySchema,
} from "@/validations/brand.validation";

const router = Router();

// All brand routes require an authenticated user. Admin scope is enforced
// inside each controller (e.g., `scope=all` only honoured for admins).
router.use(isAuthenticated);

// Collection
router.get("/", validate(listBrandsQuerySchema, "query"), listBrands);
router.post("/", validate(createBrandBodySchema), createBrand);

// Single brand — owner OR admin can read/update/delete
router.get("/:id", getBrandById);
router.patch("/:id", validate(updateBrandBodySchema), updateBrand);
router.delete("/:id", deleteBrand);

export default router;
