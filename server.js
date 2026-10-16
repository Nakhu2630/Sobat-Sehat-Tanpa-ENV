const http = require("http"), fs = require("fs"), path = require("path");

try {
  fs.readFileSync(path.join(__dirname, ".env.local"), "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch (e) {}

const chat = require("./api/chat.js");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  if (req.url.split("?")[0] === "/api/chat") {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      req.body = d;
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
      chat(req, res);
    });
    return;
  }
  const types = { ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  const ext = path.extname(rel).toLowerCase();
  const file = types[ext] && path.join(__dirname, "public", path.normalize(rel).replace(/^(\.\.[\/\\])+/, ""));
  if (file && file.startsWith(path.join(__dirname, "public"))) {
    return fs.readFile(file, (e, b) => {
      if (e) { res.statusCode = 404; return res.end("Tidak ditemukan"); }
      res.setHeader("Content-Type", types[ext]); res.end(b);
    });
  }
  fs.readFile(path.join(__dirname, "public", "index.html"), (e, b) => {
    if (e) { res.statusCode = 500; return res.end("public/index.html tidak ditemukan"); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(b);
  });
}).listen(PORT, () => console.log("SobatSehat berjalan di http://localhost:" + PORT + (process.env.GEMINI_API_KEY ? "" : "  (PERINGATAN: GEMINI_API_KEY belum diatur)")));
