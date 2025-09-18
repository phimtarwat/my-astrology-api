export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // 📡 log ไว้ก่อน
    console.log("📩 Push message received:", message);

    // ✅ ตอบกลับ GPT (Custom GPT Connector จะส่งข้อความนี้เข้าห้องแชท user โดยอัตโนมัติ)
    return res.status(200).json({
      status: "ok",
      delivered: true,
      message: message,
    });
  } catch (err) {
    console.error("❌ PushMessage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

