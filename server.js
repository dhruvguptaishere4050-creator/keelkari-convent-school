"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const USERNAME = process.env.KCS_ADMIN_USERNAME || "admin";
const PASSWORD = process.env.KCS_ADMIN_PASSWORD;
const DATA_FILE = path.join(ROOT, "data", "store.json");
const TTL = 8 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
const defaults = { notices: [
  { id: "welcome", title: "Admissions enquiries are open", body: "For Classes I–VIII", date: "2026-04-01" },
  { id: "session", title: "Welcome to the new academic session", body: "Information for parents and guardians", date: "2026-04-08" },
  { id: "updates", title: "Keep this page bookmarked", body: "Notices and updates will be posted here", date: "2026-04-15" }
], enquiries: [] };
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };

if (!PASSWORD || PASSWORD.length < 12) {
  console.error("Set KCS_ADMIN_PASSWORD to a unique password with at least 12 characters.");
  process.exit(1);
}
async function store() {
  try { return JSON.parse(await fsp.readFile(DATA_FILE, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; await write(defaults); return structuredClone(defaults); }
}
async function write(data) { await fsp.mkdir(path.dirname(DATA_FILE), { recursive: true }); await fsp.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8"); }
function json(res, status, body, headers = {}) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }); res.end(JSON.stringify(body)); }
async function body(req) { let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 20_000) throw new Error("Request too large"); } try { return JSON.parse(raw || "{}"); } catch { throw new Error("Invalid request"); } }
function value(input, max) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }
function cookie(req) { return (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("kcs_session="))?.slice(12); }
function authenticated(req) { const token = cookie(req); const session = token && sessions.get(token); if (!session || session.expires < Date.now()) { if (token) sessions.delete(token); return null; } return token; }
function admin(req, res) { if (!authenticated(req)) { json(res, 401, { error: "Please sign in to continue." }); return false; } return true; }
function throttle(req) { const key = req.socket.remoteAddress || "unknown"; const now = Date.now(); const record = attempts.get(key); if (!record || now - record.started > 900000) return false; return record.count >= 5; }
function failed(req) { const key = req.socket.remoteAddress || "unknown"; const old = attempts.get(key); attempts.set(key, old && Date.now() - old.started < 900000 ? { started: old.started, count: old.count + 1 } : { started: Date.now(), count: 1 }); }
function clearAttempts(req) { attempts.delete(req.socket.remoteAddress || "unknown"); }
function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)); }

async function api(req, res, url) {
  const data = await store();
  if (req.method === "GET" && url.pathname === "/api/notices") return json(res, 200, data.notices);
  if (req.method === "POST" && url.pathname === "/api/enquiries") {
    const input = await body(req);
    const enquiry = { id: crypto.randomUUID(), parent: value(input.parent, 100), phone: value(input.phone, 30), email: value(input.email, 120), class: value(input.class, 30), message: value(input.message, 600), received: new Date().toISOString() };
    if (!enquiry.parent || !/^[0-9+\-\s()]{8,30}$/.test(enquiry.phone) || !enquiry.class || input.consent !== true) return json(res, 400, { error: "Please complete the required fields and consent." });
    data.enquiries.unshift(enquiry); await write(data); return json(res, 201, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    if (throttle(req)) return json(res, 429, { error: "Too many sign-in attempts. Please wait 15 minutes and try again." });
    const input = await body(req); const submitted = Buffer.from(value(input.password, 500)); const expected = Buffer.from(PASSWORD);
    const matches = submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected);
    if (value(input.username, 100) !== USERNAME || !matches) { failed(req); return json(res, 401, { error: "The username or password is not correct." }); }
    clearAttempts(req); const token = crypto.randomBytes(32).toString("base64url"); sessions.set(token, { expires: Date.now() + TTL });
    const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
    return json(res, 200, { ok: true }, { "Set-Cookie": `kcs_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL / 1000};${secure}` });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/logout") { const token = authenticated(req); if (token) sessions.delete(token); return json(res, 200, { ok: true }, { "Set-Cookie": "kcs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" }); }
  if (req.method === "GET" && url.pathname === "/api/admin/session") return json(res, 200, { authenticated: Boolean(authenticated(req)) });
  if (url.pathname.startsWith("/api/admin/")) {
    if (!admin(req, res)) return;
    if (req.method === "GET" && url.pathname === "/api/admin/overview") return json(res, 200, { notices: data.notices, enquiries: data.enquiries });
    if (req.method === "POST" && url.pathname === "/api/admin/notices") {
      const input = await body(req); const notice = { id: crypto.randomUUID(), title: value(input.title, 100), body: value(input.body, 180), date: value(input.date, 10) };
      if (!notice.title || !notice.body || !validDate(notice.date)) return json(res, 400, { error: "Add a title, description and valid date." });
      data.notices.unshift(notice); await write(data); return json(res, 201, notice);
    }
    const id = url.pathname.match(/^\/api\/admin\/notices\/([a-zA-Z0-9-]+)$/)?.[1];
    if (req.method === "DELETE" && id) { data.notices = data.notices.filter(notice => notice.id !== id); await write(data); return json(res, 200, { ok: true }); }
  }
  return json(res, 404, { error: "Not found." });
}
async function files(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.resolve(ROOT, `.${requested}`);
  if (!(file === ROOT || file.startsWith(`${ROOT}${path.sep}`)) || file.includes(`${path.sep}data${path.sep}`)) { res.writeHead(403); return res.end("Forbidden"); }
  try { const stat = await fsp.stat(file); if (!stat.isFile()) throw new Error("Not file"); res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" }); fs.createReadStream(file).pipe(res); }
  catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Page not found"); }
}
http.createServer(async (req, res) => { const url = new URL(req.url, `http://${req.headers.host}`); try { if (url.pathname.startsWith("/api/")) await api(req, res, url); else await files(req, res, url); } catch (error) { console.error(error); json(res, 500, { error: "Something went wrong. Please try again." }); } }).listen(PORT, () => console.log(`Keelkari website running at http://localhost:${PORT}`));
