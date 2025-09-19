import Stripe from "stripe";
import { buffer } from "micro";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken, getExpiry, getQuota } from "../lib/utils.js";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("stripeWebhook signature error:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    try {
      const pi = event.data.object;

      const packageId = pi.metadata.packageId;
      const userId = generateUserId();   // 🔢 user_id = ตัวเลขสุ่ม 5 หลัก
      const token = generateToken();     // 🔢 token = ตัวเลขสุ่ม 5 หลัก
      const expiry = getExpiry();        // ⏳ หมดอายุ +30 วัน
      const quota = getQuota(packageId);

      const sheet = await getSheet("Members");
      await sheet.addRow({
        user_id: userId,
        token,
        expiry,
        quota,
        used_count: 0,
        package: packageId,
        "e-mail": pi.receipt_email || "",
        created_at: new Date().toISOString(),
        payment_intent_id: pi.id,
        receipt_url: pi.charges?.data[0]?.receipt_url || "",
        paid_at: new Date(pi.created * 1000).toISOString(),
      });

      console.log(`✅ Saved new member: ${userId} / ${token} (package: ${packageId})`);
    } catch (err) {
      console.error("stripeWebhook save error:", err);
    }
  }

  return res.json({ received: true });
}
