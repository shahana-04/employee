import express from "express";
import {
  getEmployeeDashboard,
  getManagerDashboard
} from "../controllers/dashboardController.js";
import { protect, requireManager } from "../middleware/auth.js";

const router = express.Router();

router.get("/employee", protect, getEmployeeDashboard);
router.get("/manager", protect, requireManager, getManagerDashboard);

export default router;
