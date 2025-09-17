import Stripe from "stripe";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/utils.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const packageQuota = {
  lite: 20,        // สมมติให้ Lite ใช้ได้ 20 ครั้ง
  standard: 50,    // Standard ใช้ได้ 50 ครั้ง
  premium: 150,    // Premium ใช้ได้ 150 ครั้ง
};

export default async function handler(req, res) {
  const { session_id, pkg } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    return res.status(400).json({ error: "Payment not completed" });
  }

  const sheets = await getSheet();
  const spreadsheetId = process.env.SHEET_ID;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Members!A2:F",
  });

  const rows = result.data.values || [];
  const existingIds = rows.map(r => r[0]);

  const newId = generateUserId(existingIds);
  const newToken = generateToken();
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 1);

  const quota = packageQuota[pkg.toLowerCase()] || 20;
  const used = 0;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Members!A2:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newId, newToken, expiry.toISOString().split("T")[0], quota, used, pkg.toUpperCase()]],
    },
  });

  res.status(200).json({
    message: "Purchase successful",
    user_id: newId,
    token: newToken,
    quota,
    package: pkg,
    expiry: expiry.toISOString().split("T")[0],
  });
}
