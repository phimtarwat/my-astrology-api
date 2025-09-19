import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    const { user_id, token } = req.body; // ใช้ POST ดีกว่า GET

    // ✅ ตรวจสอบ input
    if (!user_id || !token) {
      return res.status(400).json({
        success: false,
        message: "Missing parameters (user_id, token)",
      });
    }

    // ✅ โหลดข้อมูลจาก Google Sheet
    const sheet = await getSheet("Members");
    const rows = await sheet.getRows();
    const user = rows.find(r => r.user_id === user_id && r.token === token);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "❌ ไม่พบ user_id หรือ token",
      });
    }

    // ✅ ตรวจสอบ expiry & quota
    const expiry = new Date(user.expiry);
    const today = new Date();
    const quota = parseInt(user.quota);
    const used = parseInt(user.used_count);

    if (expiry < today) {
      return res.status(403).json({
        success: false,
        message: "❌ token หมดอายุ กรุณาซื้อแพ็กเกจใหม่",
      });
    }

    if (used >= quota) {
      return res.status(403).json({
        success: false,
        message: "❌ quota หมดแล้ว กรุณาซื้อแพ็กเกจใหม่",
      });
    }

    // ✅ หักสิทธิ์การใช้งาน 1 ครั้ง
    user.used_count = used + 1;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "✅ ใช้สิทธิ์สำเร็จ",
      remaining: quota - (used + 1),
      package: user.package,
    });

  } catch (err) {
    console.error("useToken error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

