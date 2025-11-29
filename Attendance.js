import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    status: {
      type: String,
      enum: ["present", "absent", "late", "half-day"],
      default: "present"
    },
    totalHours: { type: Number, default: 0 } // in hours
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

// Ensure one record per user per date
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
