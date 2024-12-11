import { Router } from "express";
import { addOrder, removeOrder } from "../controllers/orderControllers";
const router = Router();

router.post("/addOrder", addOrder);
router.post("/removeOrder", removeOrder);

export default router;
