import { Router } from "express";
import { isAuthenticated } from "@/middlewares/auth-middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  createBrandQuery,
  listBrandQueries,
  getBrandQueryById,
  updateBrandQuery,
  deleteBrandQuery,
  runBrandQuery,
} from "@/controllers/brandQuery";
import {
  createBrandQueryBodySchema,
  updateBrandQueryBodySchema,
  listBrandQueriesQuerySchema,
} from "@/validations/brandQuery.validation";

const router = Router();

router.use(isAuthenticated);

// Collection
router.get("/", validate(listBrandQueriesQuerySchema, "query"), listBrandQueries);
router.post("/", validate(createBrandQueryBodySchema), createBrandQuery);

// Single query — owner OR admin can read/update/delete
router.get("/:id", getBrandQueryById);
router.patch("/:id", validate(updateBrandQueryBodySchema), updateBrandQuery);
router.delete("/:id", deleteBrandQuery);

// Trigger an AI execution for this query — runs the prompt against every
// model in `targetModels`, stores results in ai_query_runs, returns summary.
router.post("/:id/run", runBrandQuery);

export default router;
