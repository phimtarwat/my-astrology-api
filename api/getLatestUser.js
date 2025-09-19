import { getSheet } from "../lib/googleSheet.js";

export default async function handler(req, res) {
  try {
    const { paymentIntentId } = req.query;

    if (!paymentIntentId) {
      return res.status(400).json({ error: "missing_payment_intent_id" });
    }

    const sheet = await getSheet("Members");
    const rows = await sheet.getRows();
    const row = rows.find(r => r.payment_intent_id === paymentIntentId);

    if (!row) {
      return res.json({ status: "pending" });
    }

    return res.json({
      status: "paid",
      userId: row.user_id,
      token: row.token,
      package: row.package,
      receipt_url: row.receipt_url,
    });
  } catch (err) {
    console.error("getLatestUser error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
