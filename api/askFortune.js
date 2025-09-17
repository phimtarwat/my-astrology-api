import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const { user_id, token, question, mode } = req.body;
  if (!user_id || !token || !question || mode !== "use") {
    return res.status(400).json({ status: "invalid", message: "Missing parameters or mode" });
  }

  try {
    const sheets = await getSheet();
    const spreadsheetId = process.env.SHEET_ID;

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Members!A2:F",
    });

    const rows = result.data.values || [];
    const user = rows.find(r => r[0] === user_id && r[1] === token);

    if (!user) {
      return res.status(200).json({ status: "invalid", message: "❌ ไม่พบผู้ใช้" });
    }

    const [uid, tok, expiry, quota, used, pkg] = user;
    const today = new Date().toISOString().split("T")[0];

    if (expiry < today || parseInt(used) >= parseInt(quota)) {
      return res.status(200).json({ status: "expired", message: "❌ สิทธิ์หมดอายุ กรุณาซื้อแพ็กเกจใหม่" });
    }

    // update quota (used+1)
    const updatedUsed = parseInt(used) + 1;
    const rowIndex = rows.indexOf(user) + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `E${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[updatedUsed]] },
    });

    // mock fortune result (คุณจะเชื่อม core จริงตรงนี้ก็ได้)
    const resultMessage = `🔮 คำทำนายสำหรับคำถาม: "${question}" (mock result)`;

    return res.status(200).json({
      status: "valid",
      message: resultMessage,
      remaining: parseInt(quota) - updatedUsed,
      result: resultMessage
    });

  } catch (err) {
    console.error("askFortune error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
}
