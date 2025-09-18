import Stripe from "stripe";
import { buffer } from "micro";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/utils.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }, // ❗ Stripe ต้องการ raw body
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
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("✅ Received event:", event.type);

  // ฟังเฉพาะ Payment Links → PaymentIntent
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    console.log("💳 PaymentIntent:", intent.id, "amount:", intent.amount);

    try {
      // ✅ ดึง line_items ของ PaymentIntent
      const lineItems = await stripe.paymentIntents.listLineItems(intent.id, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      console.log("📦 priceId:", priceId);

      // ✅ map package จาก Price ID
      let pkg = "lite";
      if (priceId === process.env.STRIPE_PRICE_STANDARD) pkg = "standard";
      else if (priceId === process.env.STRIPE_PRICE_PREMIUM) pkg = "premium";

      console.log("📦 Package mapped:", pkg);

      // ✅ เตรียม gen user_id + token
      const sheets = await getSheet();
      const spreadsheetId = process.env.SHEET_ID;

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Members!A1:F",
      });

      const rows = result.data.values || [];
      const existingIds = rows.map((r) => r[0]);

      const newId = generateUserId(existingIds);
      const newToken = generateToken();
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);

      const quotaMap = { lite: 5, standard: 10, premium: 30 };
      const quota = quotaMap[pkg.toLowerCase()] || 5;

      console.log("📝 Writing to Google Sheet:", {
        user_id: newId,
        token: newToken,
        expiry: expiry.toISOString().split("T")[0],
        quota,
        pkg,
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Members!A1:F",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[
            newId,
            newToken,
            expiry.toISOString().split("T")[0],
            quota,
            0,
            pkg
          ]],
        },
      });

      console.log(`✅ User created successfully → user_id=${newId}, token=${newToken}, pkg=${pkg}`);
    } catch (err) {
      console.error("❌ Error processing payment:", err);
      return res.status(500).send("Server error");
    }
  }

  res.json({ received: true });
}
