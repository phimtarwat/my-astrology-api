import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user_id, token, question } = req.body;
  const sheets = await getSheet();
  const spreadsheetId = process.env.SHEET_ID;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Members!A2:F",
  });
  const rows = result.data.values || [];
  const user = rows.find(r => r[0] === user_id && r[1] === token);

  if (!user) return res.status(404).json({ error: "User not found" });

  const [uid, tok, expiry, quota, used, pkg] = user;
  const today = new Date().toISOString().split("T")[0];

  if (expiry < today || parseInt(used) >= parseInt(quota)) {
    return res.status(403).json({ error: "Quota expired" });
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

  // TODO: integrate กับ core function ทำนายดวง
  res.status(200).json({
    message: "Fortune result (mock)",
    question,
    used: updatedUsed,
    remaining: parseInt(quota) - updatedUsed,
  });
}

