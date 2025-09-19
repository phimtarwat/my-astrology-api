export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // 📩 log ไว้ให้ debug
    console.log("📩 PushMessage received:", message);

    // ✅ ส่งข้อความกลับ GPT Chat (Custom GPT connector จะ handle ตรงนี้ให้ user เห็นทันที)
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
