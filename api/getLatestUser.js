import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.SHEET_ID;

    // ดึงข้อมูลจาก Google Sheet (เว้น header)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Members!A2:F",
    });

    const rows = result.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: "No users found" });
    }

    // เลือกแถวล่าสุด
    const lastRow = rows[rows.length - 1];
    const [user_id, token, expiry, quota, used_count, pkg] = lastRow;

    return res.json({
      user_id,
      token,
      expiry,
      quota,
      used_count,
      package: pkg,
    });
  } catch (err) {
    console.error("❌ Error fetching latest user:", err);
    res.status(500).json({ error: "Server error" });
  }
}

