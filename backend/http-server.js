// http-app.js
const path = require('path');
const fs = require('fs');

function setupHttpServer(req, res) {
  const rootPath = path.join(__dirname, '..', 'frontend'); // Root for frontend files

  // Helper function to serve files
  const serveFile = (filePath, contentType, errMessage = 'File Not Found') => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`Error serving ${filePath}:`, err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(errMessage);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  };

  // Serve the index.html file when the root URL is requested
  if (req.url === '/') {
    serveFile(path.join(rootPath, 'index.html'), 'text/html', 'Server Error');
  }
  // Serve JavaScript files
  else if (req.url.startsWith('/js/') && req.url.endsWith('.js')) {
    serveFile(path.join(rootPath, req.url), 'application/javascript');
  }
  // Serve styles.css
  else if (req.url === '/styles.css') {
    serveFile(path.join(rootPath, 'styles.css'), 'text/css');
  }
  // Serve image files from the assets directory
  else if (req.url.startsWith('/assets/') && (req.url.endsWith('.png') || req.url.endsWith('.jpg') || req.url.endsWith('.gif'))) {
    const ext = path.extname(req.url).toLowerCase();
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif'
    }[ext];
    serveFile(path.join(rootPath, req.url), contentType);
  }
  // Return 404 for any other requests
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

module.exports = setupHttpServer;