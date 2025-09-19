import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { packageId, email } = req.body;

    const priceMap = {
      premium: 19900,   // 199.00 THB
      standard: 9900,   // 99.00 THB
      lite: 5900,       // 59.00 THB
    };

    const amount = priceMap[packageId];
    if (!amount) {
      return res.status(400).json({ error: "invalid_package" });
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "thb",
      payment_method_types: ["promptpay"],
      receipt_email: email || undefined,
      metadata: { packageId },
    });

    return res.json({
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      qr: pi.next_action?.promptpay_display_qr_code?.image?.png,
    });
  } catch (err) {
    console.error("createCheckout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
