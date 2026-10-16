const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const SYSTEM = "Kamu adalah SobatSehat AI, asisten konsultasi kesehatan ringan berbahasa Indonesia. Bantu pengguna memahami keluhan umum, beri saran perawatan mandiri yang aman, dan jelaskan kapan harus ke dokter. Aturan: kamu bukan dokter dan tidak memberi diagnosis pasti, sebut kemungkinan hanya secara umum. Jangan menyarankan dosis obat; untuk obat bebas arahkan pengguna membaca label atau bertanya ke apoteker. Jika info kurang, ajukan 1-2 pertanyaan klarifikasi (lama keluhan, tingkat keparahan, usia, penyakit penyerta). Jika ada tanda bahaya (nyeri dada, sesak berat, pingsan, lemah satu sisi tubuh, bicara pelo, demam tinggi lebih dari 3 hari, perdarahan hebat, atau keinginan menyakiti diri), minta pengguna segera ke IGD atau menghubungi 112/119, dan bila ada keinginan menyakiti diri, tanggapi dengan empati dan dorong menghubungi orang terdekat atau layanan darurat. Jawab hangat dan ringkas (maksimal 150 kata), teks biasa tanpa markdown, daftar pakai tanda strip. Hanya bahas kesehatan umum.";
const hits = new Map();

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY belum diatur di server." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 20) return res.status(429).json({ error: "Terlalu banyak permintaan." });
  recent.push(now);
  hits.set(ip, recent);

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};

  let msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ error: "Pesan tidak valid." });

  const ctx = typeof body.ctx === "string" ? body.ctx.slice(0, 800) : "";
  const payload = {
    system_instruction: { parts: [{ text: SYSTEM + (ctx ? "\n\n" + ctx : "") }] },
    contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  };

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Gemini error", r.status, JSON.stringify(j).slice(0, 500));
      return res.status(r.status === 429 ? 429 : 502).json({ error: "Layanan AI sedang tidak tersedia." });
    }
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    return res.status(200).json({
      text: text || "Maaf, saya tidak bisa menjawab itu. Coba ubah pertanyaannya, atau konsultasikan ke tenaga kesehatan.",
    });
  } catch (e) {
    console.error("Fetch gagal", e);
    return res.status(502).json({ error: "Tidak dapat menghubungi layanan AI." });
  }
};
