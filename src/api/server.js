// src/api/server.js
const express = require('express');
const cors = require('cors');
const webhooksRouter = require('./webhooks');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`📡 API: ${req.method} ${req.path}`, {
    timestamp: new Date().toISOString(),
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
      'x-api-key': req.get('x-api-key') ? '[HIDDEN]' : 'none'
    },
    query: req.query,
    body: Object.keys(req.body).length > 0 ? '[HAS_BODY]' : '[NO_BODY]'
  });
  next();
});

// Подключаем маршруты
app.use('/api/webhooks', webhooksRouter);

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'FlowBot API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/webhooks/health',
      morning_tasks: 'POST /api/webhooks/send-morning-tasks',
      evening_reflection: 'POST /api/webhooks/send-evening-reflection',
      active_users: 'GET /api/webhooks/active-users',
      update_level: 'POST /api/webhooks/update-user-level'
    },
    authentication: 'API Key required in x-api-key header or api_key query parameter'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_routes: [
      'GET /',
      'GET /api/webhooks/health',
      'GET /api/webhooks/active-users',
      'POST /api/webhooks/send-morning-tasks',
      'POST /api/webhooks/send-evening-reflection',
      'POST /api/webhooks/update-user-level'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('🚨 API Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message || 'Something went wrong'
  });
});

const PORT = process.env.PORT || process.env.API_PORT || 3001;

function startApiServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', (err) => {
      if (err) {
        console.error('❌ Failed to start API server:', err);
        reject(err);
      } else {
        // Явный вывод порта для детекции Timeweb
        console.log(`Listening on port ${PORT}`);
        console.log(`🚀 FlowBot API Server running on port ${PORT}`);
        console.log(`📡 Webhooks available at: http://0.0.0.0:${PORT}/api/webhooks`);
        console.log(`🏥 Health check: http://0.0.0.0:${PORT}/api/webhooks/health`);
        resolve(server);
      }
    });
    
    server.on('error', (err) => {
      console.error('❌ API Server error:', err);
      reject(err);
    });
  });
}

module.exports = { app, startApiServer };