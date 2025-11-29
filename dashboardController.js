import Attendance from "../models/Attendance.js";
import User from "../models/User.js";

const normalizeDate = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getEmployeeDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = normalizeDate(new Date());

    const todayRecord = await Attendance.findOne({ userId, date: today });

    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const startMonth = new Date(y, m, 1);
    const endMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const monthRecords = await Attendance.find({
      userId,
      date: { $gte: startMonth, $lte: endMonth }
    })
      .sort({ date: -1 })
      .lean();

    let present = 0,
      absent = 0,
      late = 0,
      totalHours = 0;

    monthRecords.forEach((r) => {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      totalHours += r.totalHours || 0;
    });

    const last7 = await Attendance.find({ userId })
      .sort({ date: -1 })
      .limit(7)
      .lean();

    res.json({
      todayStatus: todayRecord
        ? todayRecord.checkOutTime
          ? "Checked Out"
          : "Checked In"
        : "Not Checked In",
      monthSummary: {
        present,
        absent,
        late,
        totalHours: Number(totalHours.toFixed(2))
      },
      recentAttendance: last7
    });
  } catch (error) {
    console.error("Employee dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getManagerDashboard = async (req, res) => {
  try {
    const totalEmployees = await User.countDocuments({ role: "employee" });

    const today = normalizeDate(new Date());

    const todayRecords = await Attendance.find({ date: today })
      .populate("userId", "employeeId name department")
      .lean();

    let presentCount = 0;
    let lateArrivals = [];

    todayRecords.forEach((r) => {
      if (r.checkInTime) presentCount++;
      if (r.status === "late") lateArrivals.push(r);
    });

    // Weekly trend (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const weekRecords = await Attendance.find({
      date: { $gte: sevenDaysAgo, $lte: today }
    }).lean();

    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      trendMap[key] = { date: key, present: 0 };
    }

    weekRecords.forEach((r) => {
      const key = r.date.toISOString().slice(0, 10);
      if (!trendMap[key]) trendMap[key] = { date: key, present: 0 };
      if (r.checkInTime) trendMap[key].present++;
    });

    const weeklyTrend = Object.values(trendMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Department-wise attendance (today)
    const deptMap = {};
    todayRecords.forEach((r) => {
      const dept = r.userId.department || "Unknown";
      if (!deptMap[dept]) deptMap[dept] = { department: dept, present: 0 };
      if (r.checkInTime) deptMap[dept].present++;
    });

    const departmentWise = Object.values(deptMap);

    // List of absent employees today (rough version)
    const presentUserIds = todayRecords
      .filter((r) => r.checkInTime)
      .map((r) => r.userId._id.toString());

    const absentEmployees = await User.find({
      role: "employee",
      _id: { $nin: presentUserIds }
    }).select("name employeeId department");

    res.json({
      totalEmployees,
      todayAttendance: {
        present: presentCount,
        // absent = totalEmployees - presentCount (approx)
        absent: totalEmployees - presentCount
      },
      lateArrivals,
      weeklyTrend,
      departmentWise,
      absentEmployeesToday: absentEmployees
    });
  } catch (error) {
    console.error("Manager dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
