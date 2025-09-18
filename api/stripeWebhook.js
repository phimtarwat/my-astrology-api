import Stripe from "stripe";
import { buffer } from "micro";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/utils.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // ✅ 1) พยายามอ่านจาก metadata ก่อน (กรณี Checkout API)
    let pkg = session.metadata?.packageId;

    // ✅ 2) ถ้าไม่มี metadata → แปลว่ามาจาก Payment Links
    if (!pkg) {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data[0]?.price?.id;

        if (priceId === process.env.STRIPE_PRICE_LITE) pkg = "lite";
        else if (priceId === process.env.STRIPE_PRICE_STANDARD) pkg = "standard";
        else if (priceId === process.env.STRIPE_PRICE_PREMIUM) pkg = "premium";
        else pkg = "lite"; // default
      } catch (err) {
        console.error("❌ Error fetching line items:", err);
        pkg = "lite";
      }
    }

    // ✅ gen user_id / token
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

      console.log(`✅ User created: ${newId}, token: ${newToken}, pkg=${pkg}`);
    } catch (err) {
      console.error("❌ Google Sheets error:", err);
    }
  }

  res.json({ received: true });
}
