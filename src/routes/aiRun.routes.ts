import { Router } from "express";
import { isAuthenticated } from "@/middlewares/auth-middleware";
import { validate } from "@/middlewares/validate.middleware";
import { listAIRuns, getAIRunById } from "@/controllers/aiRun";
import { listAIRunsQuerySchema } from "@/validations/aiRun.validation";

const router = Router();

// All run endpoints require auth. Admin scope (cross-user visibility) is
// enforced inside the controller.
router.use(isAuthenticated);

router.get("/", validate(listAIRunsQuerySchema, "query"), listAIRuns);
router.get("/:id", getAIRunById);

export default router;
