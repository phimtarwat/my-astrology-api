import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  const { user_id, token } = req.query;
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
    return res.status(403).json({
      error: "Quota expired",
      buy_url: `${process.env.BASE_URL}/api/createCheckout`,
    });
  }

  res.status(200).json({ message: "Valid", remaining: quota - used, package: pkg });
}

