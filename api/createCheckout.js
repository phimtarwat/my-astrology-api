import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const packageMap = {
  lite: process.env.STRIPE_PRICE_LITE,
  standard: process.env.STRIPE_PRICE_STANDARD,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { packageId } = req.body;
  const priceId = packageMap[packageId?.toLowerCase()];

  if (!priceId) return res.status(400).json({ error: "Invalid packageId" });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${process.env.BASE_URL}/api/paymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error("createCheckout error:", err);
    return res.status(500).json({ error: "Stripe error" });
  }
}
