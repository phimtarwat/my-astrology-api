import Stripe from "stripe";
import { getSheet } from "../lib/googleSheet.js";
import { generateUserId, generateToken } from "../lib/utils.js";
import sendgrid from "@sendgrid/mail";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

export const config = {
  api: { bodyParser: false },
};

// ✅ อ่าน raw body
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(Buffer.from(data));
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

// ✅ helper ส่งเมล
async function sendUserTokenEmail(email, userId, token, pkg, quota, expiry) {
  const message = {
    to: email,
    from: process.env.SENDER_EMAIL, // ตั้งค่าที่ SendGrid verified ไว้
    subject: "✅ การชำระเงินสำเร็จแล้วค่ะ",
    text: `✅ การชำระเงินสำเร็จแล้วค่ะ
user_id=${userId}
token=${token}
แพ็กเกจ: ${pkg} (quota ${quota} ครั้ง)
วันหมดอายุ: ${expiry}`,
  };

  await sendgrid.send(message);
  console.log("📧 Sent email to:", email);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  const buf = await getRawBody(req);

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

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    console.log("💳 PaymentIntent:", intent.id, "amount:", intent.amount);

    try {
      // ✅ map package จาก amount
      let pkg = "lite";
      if (intent.amount === 9900) pkg = "standard";
      else if (intent.amount === 19900) pkg = "premium";

      // ✅ gen user_id + token
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

      console.log(`✅ User created: ${newId}, token=${newToken}, pkg=${pkg}`);

      // ✅ ส่งอีเมลให้ลูกค้า
      const customerEmail =
        intent.receipt_email || intent.charges.data[0]?.billing_details?.email;

      if (customerEmail) {
        await sendUserTokenEmail(
          customerEmail,
          newId,
          newToken,
          pkg,
          quota,
          expiry.toISOString().split("T")[0]
        );
      } else {
        console.warn("⚠️ No customer email found in payment intent");
      }
    } catch (err) {
      console.error("❌ Error processing payment:", err);
      return res.status(500).send("Server error");
    }
  }

  res.json({ received: true });
}
