import Stripe from "stripe";
import { buffer } from "micro";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/utils.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ❗ ต้องปิด bodyParser ของ Vercel (Stripe ต้องใช้ raw body)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET   // ✅ ใส่ Signing Secret จาก Stripe Dashboard
    );
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
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

      const pkg = session.metadata?.packageId || "lite";   // ✅ ใช้ metadata จาก createCheckout
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

      console.log(`✅ User created: ${newId}, token: ${newToken}`);
    } catch (err) {
      console.error("❌ Google Sheets error:", err);
    }
  }

  res.json({ received: true });
}

