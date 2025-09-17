import Stripe from "stripe";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/utils.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    const { session_id, pkg } = req.query;
    if (!session_id || !pkg) {
      return res.status(400).json({ status: "error", message: "Missing session_id or pkg" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ status: "failed", message: "Payment not completed" });
    }

    const sheets = await getSheet();
    const spreadsheetId = process.env.SHEET_ID;

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Members!A1:F",
    });

    const rows = result.data.values || [];
    const existingIds = rows.map(r => r[0]);

    const newId = generateUserId(existingIds);
    const newToken = generateToken();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    // quota mock
    const quotaMap = { lite: 5, standard: 10, premium: 30 };
    const quota = quotaMap[pkg.toLowerCase()] || 5;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Members!A1:F",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[newId, newToken, expiry.toISOString().split("T")[0], quota, 0, pkg]],
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Purchase successful",
      user_id: newId,
      token: newToken,
      quota,
      package: pkg,
      expiry: expiry.toISOString().split("T")[0],
    });

  } catch (err) {
    console.error("paymentSuccess error:", err);
    return res.status(500).json({ status: "error", message: "Stripe or Google Sheets error" });
  }
}
