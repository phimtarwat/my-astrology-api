import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ status: "error", message: "Method not allowed" });
    }

    const { user_id, token, question, mode } = req.body;

    if (!user_id || !token || !question || mode !== "use") {
      return res.status(400).json({
        status: "invalid",
        message: "Missing parameters (user_id, token, question, mode=use)",
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
      return res.status(200).json({ status: "invalid", message: "❌ ไม่พบ user_id หรือ token" });
    }

    const [uid, tok, expiry, quota, used, pkg] = user;
    const today = new Date().toISOString().split("T")[0];

    if (expiry < today || parseInt(used) >= parseInt(quota)) {
      return res.status(200).json({ status: "expired", message: "❌ token หมดอายุหรือ quota หมด" });
    }

    // update quota
    const updatedUsed = parseInt(used) + 1;
    const rowIndex = rows.indexOf(user) + 1; // +1 เพราะเริ่ม A1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `E${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[updatedUsed]] },
    });

    // mock fortune
    const fortuneResult = `🔮 คำทำนายสำหรับคำถาม: "${question}" (demo result)`;

    return res.status(200).json({
      status: "valid",
      message: fortuneResult,
      remaining: parseInt(quota) - updatedUsed,
      result: fortuneResult,
    });

  } catch (err) {
    console.error("askFortune error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
}
