const express = require('express');
const https = require('https');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const app = express();
const proxy = httpProxy.createProxyServer({});

// SSL options
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Proxy API requests to the HTTP backend
app.use('/api', (req, res) => {
  console.log(`[PROXY] API request: ${req.method} ${req.url}`);
  proxy.web(req, res, {
    target: 'http://localhost:8000/api',
    changeOrigin: true,
    secure: false
  });
});

// Proxy Socket.IO requests
app.use('/socket.io', (req, res) => {
  console.log(`[PROXY] Socket.IO request: ${req.method} ${req.url}`);
  proxy.web(req, res, {
    target: 'http://localhost:8000',
    changeOrigin: true,
    secure: false,
    ws: true
  });
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.status(500).send('Proxy error');
});

// Handle WebSocket upgrades
app.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io')) {
    proxy.ws(req, socket, head, {
      target: 'http://localhost:8000'
    });
  }
});

// Start HTTPS server
const PORT = 443;
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS server running on https://localhost`);
  console.log('Serving frontend and proxying API to http://localhost:8000');
});