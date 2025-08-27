import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


const PORT = 3000;

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const indexPath = path.join(__dirname, "index.html");
       
      fs.readFile(indexPath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Server Error");
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(data);
        }
      });
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(
    `Dev server running at \x1b[94m http://localhost:${PORT} \x1b[0m`
  );
});
