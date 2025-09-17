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

    const sheets = await getSheet();
    const spreadsheetId = process.env.SHEET_ID;

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Members!A1:F",
    });

    const rows = result.data.values || [];
    const user = rows.find(r => r[0] === user_id && r[1] === token);

    if (!user) {
      return res.status(200).json({
        status: "invalid",
        message: "❌ ไม่พบ user_id หรือ token",
      });
    }

    const [uid, tok, expiry, quota, used, pkg] = user;
    const today = new Date().toISOString().split("T")[0];

    if (expiry < today || parseInt(used) >= parseInt(quota)) {
      return res.status(200).json({
        status: "expired",
        message: "❌ token หมดอายุหรือ quota หมด กรุณาซื้อแพ็กเกจใหม่",
      });
    }

    if (mode === "check") {
      return res.status(200).json({
        status: "valid",
        message: "✅ token ถูกต้อง",
        remaining: parseInt(quota) - parseInt(used),
        package: pkg,
      });
    }

    return res.status(400).json({ status: "invalid", message: "Invalid mode" });

  } catch (err) {
    console.error("checkToken error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
}
