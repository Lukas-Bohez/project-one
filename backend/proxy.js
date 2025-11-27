const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const app = express();

// Create proxy
const proxy = httpProxy.createProxyServer({
  target: 'http://127.0.0.1:8000',
  changeOrigin: true
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (!res.headersSent) {
    res.status(500).send('Proxy error');
  }
});

// Proxy ALL /api requests
app.use('/api', (req, res) => {
  proxy.web(req, res, {
    target: 'http://127.0.0.1:8000/api'
  });
});

// Proxy Socket.IO requests
app.use('/socket.io', (req, res) => {
  proxy.web(req, res, {
    target: 'http://127.0.0.1:8000'
  });
});

// Create HTTP server (no SSL)
const server = http.createServer(app);

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io')) {
    proxy.ws(req, socket, head, {
      target: 'http://127.0.0.1:8000'
    });
  }
});

// Start HTTP server on port 80 or 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`HTTP server running on http://127.0.0.1:${PORT}`);
  console.log('Proxying /api/* to http://127.0.0.1:8000/api/*');
});