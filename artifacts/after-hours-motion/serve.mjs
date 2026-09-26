import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Only these two public prototype directories are exposed, never the repository.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowed = ["after-hours", "after-hours-motion"];
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".md": "text/plain; charset=utf-8" };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(302, { Location: "/after-hours-motion/" + url.search + "#/home" });
      return res.end();
    }
    const pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(root, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
    if (!allowed.some((dir) => target.startsWith(path.join(root, dir) + path.sep))) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4318, "127.0.0.1", () => process.stdout.write("Motion studies: http://127.0.0.1:4318/after-hours-motion/\n"));
