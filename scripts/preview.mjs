import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist", import.meta.url));
const port = Number(process.env.PORT ?? 5174);
const apiTarget = new URL(process.env.API_TARGET ?? "http://localhost:8088");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function proxyApi(clientRequest, clientResponse) {
  const upstream = request(
    new URL(clientRequest.url, apiTarget),
    {
      method: clientRequest.method,
      headers: clientRequest.headers
    },
    (upstreamResponse) => {
      clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(clientResponse);
    }
  );

  upstream.on("error", () => {
    clientResponse.writeHead(502, { "Content-Type": "application/json" });
    clientResponse.end(JSON.stringify({ message: "ShareBill API is unavailable" }));
  });

  clientRequest.pipe(upstream);
}

function sendStatic(clientRequest, clientResponse) {
  const url = new URL(clientRequest.url ?? "/", `http://${clientRequest.headers.host}`);
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, requestedPath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }

  clientResponse.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(clientResponse);
}

createServer((clientRequest, clientResponse) => {
  if (clientRequest.url?.startsWith("/api/")) {
    proxyApi(clientRequest, clientResponse);
    return;
  }

  sendStatic(clientRequest, clientResponse);
}).listen(port, "0.0.0.0", () => {
  console.log(`ShareBill preview: http://localhost:${port}`);
});
