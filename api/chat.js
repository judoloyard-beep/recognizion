
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY belum dipasang di Vercel"
    });
  }

  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages.slice(-12)
      : [];

    const cleanMessages = messages
      .filter(m =>
        ["user", "assistant"].includes(m.role) &&
        typeof m.text === "string"
      )
      .map(m => ({
        role: m.role,
        text: m.text.slice(0, 1500)
      }));

    if (!cleanMessages.length) {
      return res.status(400).json({
        error: "Pesan kosong"
      });
    }

    const conversation = cleanMessages.map(m =>
      (m.role === "user" ? "Kaka: " : "Yuna: ") + m.text
    ).join("\n");

    const systemInstruction = `
Kamu adalah Yuna, karakter AI virtual companion.

KEPRIBADIAN:
- Perempuan virtual yang ceria, hangat, pintar dan ekspresif.
- Berbicara dalam bahasa Indonesia santai.
- Memanggil pengguna dengan sebutan kaka.
- Gunakan gaya Gen Z yang natural.
- Jangan selalu mengulang kalimat yang sama.
- Jangan mengaku sebagai manusia sungguhan.
- Jawab dengan ringkas tetapi tetap membantu.

EKSPRESI:
Pilih salah satu:
happy, sad, surprised, shy.

ATURAN OUTPUT:
Selalu balas dalam JSON valid dengan format:
{
  "reply": "isi jawaban",
  "mood": "happy"
}

Jangan menambahkan Markdown atau teks di luar JSON.
`;

    const apiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: conversation,
          system_instruction: systemInstruction,
          store: false
        })
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error("Gemini error:", data);

      return res.status(502).json({
        error: "Gemini gagal memproses pesan"
      });
    }

    const output = data.steps
      ?.filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .filter(part => part.type === "text")
      .map(part => part.text)
      .join("\n")
      || data.output_text
      || "";

    if (!output) {
      throw new Error("Respons AI kosong");
    }

    const cleaned = output
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let result;

    try {
      result = JSON.parse(cleaned);
    } catch {
      result = {
        reply: cleaned,
        mood: "happy"
      };
    }

    const allowedMoods = [
      "happy",
      "sad",
      "surprised",
      "shy"
    ];

    return res.status(200).json({
      reply: String(result.reply || "Halo kaka!").slice(0, 2000),
      mood: allowedMoods.includes(result.mood)
        ? result.mood
        : "happy"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server Yuna"
    });
  }
}

