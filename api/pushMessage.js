export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: "Missing user_id or message" });
    }

    console.log("📩 PushMessage received:", { user_id, message });

    // 🔗 Forward ไปยัง GPT Connector
    const connectorRes = await fetch(process.env.GPT_CONNECTOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        messages: [
          {
            role: "assistant",
            content: message,
          },
        ],
      }),
    });

    if (!connectorRes.ok) {
      const errText = await connectorRes.text();
      console.error("❌ Failed to deliver to GPT:", errText);
      return res.status(502).json({
        error: "Failed to deliver message to GPT",
        detail: errText,
      });
    }

    const data = await connectorRes.json();

    return res.status(200).json({
      status: "ok",
      delivered: true,
      gpt_response: data,
    });
  } catch (err) {
    console.error("❌ PushMessage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
