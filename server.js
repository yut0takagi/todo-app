import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data.json");
const PORT = 57891;

const defaultData = {
  columns: [
    { id: "backlog", title: "Backlog" },
    { id: "todo", title: "Todo" },
    { id: "doing", title: "In Progress" },
    { id: "done", title: "Done" },
  ],
  tasks: [],
};

async function loadData() {
  if (!existsSync(DATA_PATH)) {
    await writeFile(DATA_PATH, JSON.stringify(defaultData, null, 2), "utf-8");
    return structuredClone(defaultData);
  }
  const raw = await readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

async function saveData(data) {
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function send(res, status, payload, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (payload === null) {
    res.end();
    return;
  }
  res.end(type === "application/json" ? JSON.stringify(payload) : payload);
}

function notFound(res) {
  send(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, null);
    return;
  }

  if (req.url === "/" && req.method === "GET") {
    const html = await readFile(join(__dirname, "index.html"), "utf-8");
    send(res, 200, html, "text/html");
    return;
  }

  if (req.url?.startsWith("/detail.html") && req.method === "GET") {
    const html = await readFile(join(__dirname, "detail.html"), "utf-8");
    send(res, 200, html, "text/html");
    return;
  }

  if (req.url === "/style.css" && req.method === "GET") {
    const css = await readFile(join(__dirname, "style.css"), "utf-8");
    send(res, 200, css, "text/css");
    return;
  }

  if (req.url === "/app.js" && req.method === "GET") {
    const js = await readFile(join(__dirname, "app.js"), "utf-8");
    send(res, 200, js, "text/javascript");
    return;
  }

  if (req.url === "/app-detail.js" && req.method === "GET") {
    const js = await readFile(join(__dirname, "app-detail.js"), "utf-8");
    send(res, 200, js, "text/javascript");
    return;
  }

  if (req.url === "/api/data" && req.method === "GET") {
    const data = await loadData();
    send(res, 200, data);
    return;
  }

  if (req.url === "/api/data" && req.method === "PUT") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        await saveData(parsed);
        send(res, 200, { ok: true });
      } catch (err) {
        send(res, 400, { error: "Invalid JSON" });
      }
    });
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`Local TODO server running on http://localhost:${PORT}`);
});
