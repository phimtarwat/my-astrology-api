import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    const { user_id, token, mode } = req.query;

    // ✅ ตรวจสอบ input
    if (!user_id || !token || !mode) {
      return res.status(400).json({
        status: "invalid",
        message: "Missing parameters (user_id, token, mode)",
      });
    }

    // ✅ โหลดข้อมูลจาก Google Sheet
    const sheet = await getSheet("Members");
    const rows = await sheet.getRows();
    const user = rows.find(r => r.user_id === user_id && r.token === token);

    if (!user) {
      return res.status(200).json({
        status: "invalid",
        message: "❌ ไม่พบ user_id หรือ token",
      });
    }

    // ✅ ตรวจสอบ expiry & quota
    const expiry = new Date(user.expiry);
    const today = new Date();
    const quota = parseInt(user.quota);
    const used = parseInt(user.used_count);

    if (expiry < today || used >= quota) {
      return res.status(200).json({
        status: "expired",
        message: "❌ token หมดอายุหรือ quota หมด กรุณาซื้อแพ็กเกจใหม่",
      });
    }

    // ✅ ตรวจสอบ mode
    if (mode === "check") {
      return res.status(200).json({
        status: "valid",
        message: "✅ token ถูกต้อง",
        remaining: quota - used,
        package: user.package,
      });
    }

    return res.status(400).json({ status: "invalid", message: "Invalid mode" });

  } catch (err) {
    console.error("checkToken error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
}
