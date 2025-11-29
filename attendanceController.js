import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import { Parser } from "json2csv";

// Helper to normalize date to midnight
const normalizeDate = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

// ================= Employee ==================
export const checkIn = async (req, res) => {
  try {
    const today = normalizeDate(new Date());
    const existing = await Attendance.findOne({
      userId: req.user._id,
      date: today
    });

    if (existing && existing.checkInTime) {
      return res.status(400).json({ message: "Already checked in today" });
    }

    const now = new Date();

    let status = "present";
    if (now.getHours() >= 10) status = "late"; // simple rule

    const attendance =
      existing ||
      new Attendance({
        userId: req.user._id,
        date: today
      });

    attendance.checkInTime = now;
    attendance.status = status;

    await attendance.save();

    res.json({ message: "Checked in", attendance });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const checkOut = async (req, res) => {
  try {
    const today = normalizeDate(new Date());
    const attendance = await Attendance.findOne({
      userId: req.user._id,
      date: today
    });

    if (!attendance || !attendance.checkInTime) {
      return res
        .status(400)
        .json({ message: "No check-in found for today" });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ message: "Already checked out today" });
    }

    const now = new Date();
    attendance.checkOutTime = now;

    const diffMs = now - attendance.checkInTime;
    const hours = diffMs / (1000 * 60 * 60);
    attendance.totalHours = Number(hours.toFixed(2));

    await attendance.save();

    res.json({ message: "Checked out", attendance });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyHistory = async (req, res) => {
  try {
    const { month, year } = req.query;

    const filter = { userId: req.user._id };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(filter)
      .sort({ date: -1 })
      .lean();

    res.json({ records });
  } catch (error) {
    console.error("My history error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = month ? Number(month) - 1 : now.getMonth();
    const y = year ? Number(year) : now.getFullYear();

    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const records = await Attendance.find({
      userId: req.user._id,
      date: { $gte: start, $lte: end }
    }).lean();

    let present = 0,
      absent = 0,
      late = 0,
      halfDay = 0,
      totalHours = 0;

    records.forEach((r) => {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "half-day") halfDay++;

      totalHours += r.totalHours || 0;
    });

    res.json({
      month: m + 1,
      year: y,
      present,
      absent,
      late,
      halfDay,
      totalHours: Number(totalHours.toFixed(2))
    });
  } catch (error) {
    console.error("My summary error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getTodayStatus = async (req, res) => {
  try {
    const today = normalizeDate(new Date());
    const attendance = await Attendance.findOne({
      userId: req.user._id,
      date: today
    });

    res.json({
      status: attendance
        ? attendance.checkOutTime
          ? "Checked Out"
          : "Checked In"
        : "Not Checked In",
      attendance
    });
  } catch (error) {
    console.error("Today status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= Manager ===================
export const getAllAttendance = async (req, res) => {
  try {
    const { employeeId, date, status } = req.query;

    const filter = {};
    if (date) {
      const d = normalizeDate(new Date(date));
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }
    if (status) filter.status = status;

    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (user) {
        filter.userId = user._id;
      } else {
        return res.json({ records: [] });
      }
    }

    const records = await Attendance.find(filter)
      .populate("userId", "name email employeeId department")
      .sort({ date: -1 });

    res.json({ records });
  } catch (error) {
    console.error("All attendance error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getEmployeeAttendance = async (req, res) => {
  try {
    const { id } = req.params; // userId
    const { month, year } = req.query;

    const filter = { userId: id };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(filter)
      .sort({ date: -1 })
      .lean();

    res.json({ records });
  } catch (error) {
    console.error("Employee attendance error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getTeamSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const target = date ? normalizeDate(new Date(date)) : normalizeDate(new Date());

    const records = await Attendance.find({ date: target }).lean();

    let present = 0,
      absent = 0,
      late = 0,
      halfDay = 0;

    records.forEach((r) => {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "half-day") halfDay++;
    });

    res.json({ date: target, present, absent, late, halfDay });
  } catch (error) {
    console.error("Team summary error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportAttendanceCSV = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    const filter = {};

    if (startDate && endDate) {
      const start = normalizeDate(new Date(startDate));
      const end = normalizeDate(new Date(endDate));
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    }

    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (user) filter.userId = user._id;
      else return res.json({ message: "No records" });
    }

    const records = await Attendance.find(filter)
      .populate("userId", "name email employeeId department")
      .lean();

    const data = records.map((r) => ({
      employeeId: r.userId.employeeId,
      name: r.userId.name,
      department: r.userId.department,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      checkInTime: r.checkInTime ? r.checkInTime.toISOString() : "",
      checkOutTime: r.checkOutTime ? r.checkOutTime.toISOString() : "",
      totalHours: r.totalHours
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment("attendance_report.csv");
    return res.send(csv);
  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getTodayTeamStatus = async (req, res) => {
  try {
    const today = normalizeDate(new Date());
    const records = await Attendance.find({ date: today })
      .populate("userId", "name email employeeId department")
      .lean();

    const present = [];
    const absent = []; // requires knowing all employees; here we just list records

    records.forEach((r) => {
      if (r.checkInTime) present.push(r);
    });

    res.json({
      date: today,
      presentCount: present.length,
      present,
      // For full absent list, fetch all employees and subtract present ones.
      note: "Absent list requires comparing with all employees, implement on demand."
    });
  } catch (error) {
    console.error("Today team status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
