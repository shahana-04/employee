import express from "express";
import {
  checkIn,
  checkOut,
  getMyHistory,
  getMySummary,
  getTodayStatus,
  getAllAttendance,
  getEmployeeAttendance,
  getTeamSummary,
  exportAttendanceCSV,
  getTodayTeamStatus
} from "../controllers/attendanceController.js";
import { protect, requireManager } from "../middleware/auth.js";

const router = express.Router();

// Employee
router.post("/checkin", protect, checkIn);
router.post("/checkout", protect, checkOut);
router.get("/my-history", protect, getMyHistory);
router.get("/my-summary", protect, getMySummary);
router.get("/today", protect, getTodayStatus);

// Manager
router.get("/all", protect, requireManager, getAllAttendance);
router.get("/employee/:id", protect, requireManager, getEmployeeAttendance);
router.get("/summary", protect, requireManager, getTeamSummary);
router.get("/export", protect, requireManager, exportAttendanceCSV);
router.get("/today-status", protect, requireManager, getTodayTeamStatus);

export default router;
