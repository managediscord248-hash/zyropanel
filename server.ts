import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { dockerManager } from './server/dockerManager';
import { PlayitManager } from './server/playitManager';
import { verifyToken } from './server/auth';
import { db } from './server/db';

const PORT = 3000;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Mount backend API routes FIRST
  app.use('/api', apiRouter);

  // WebSocket Server for Console & Playit
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = req.url || '';
    const parsedUrl = new URL(url, 'http://localhost');
    const token = parsedUrl.searchParams.get('token');

    // Authenticate token
    if (!token) {
      ws.close(4001, 'Authentication token required');
      return;
    }
    const user = verifyToken(token);
    if (!user) {
      ws.close(4003, 'Invalid or expired authentication token');
      return;
    }
    
    // Console WebSocket: /ws/console/:serverId
    if (url.startsWith('/ws/console/')) {
      const serverId = url.split('/ws/console/')[1]?.split('?')[0];
      if (serverId) {
        const srv = db.servers.find((s) => s.id === serverId);
        if (!srv) {
          ws.close(4004, 'Server not found');
          return;
        }
        if (user.role !== 'ADMIN' && srv.owner_id !== user.id) {
          ws.close(4003, 'Unauthorized access to server');
          return;
        }

        // Send initial logs
        const initialLogs = dockerManager.getLogs(serverId, 100);
        ws.send(JSON.stringify({ type: 'logs', data: initialLogs }));

        // Interval to stream active logs
        const streamInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const stats = dockerManager.getStats(serverId);
            ws.send(JSON.stringify({ type: 'stats', data: stats }));
          }
        }, 1500);

        ws.on('message', (msgData) => {
          try {
            const payload = JSON.parse(msgData.toString());
            if (payload.action === 'command' && payload.command) {
              const output = dockerManager.sendCommand(serverId, payload.command);
              ws.send(JSON.stringify({ type: 'command_output', data: output }));
            }
          } catch (e) {}
        });

        ws.on('close', () => {
          clearInterval(streamInterval);
        });
      }
    } 
    // Playit WebSocket: /ws/playit/:serverId
    else if (url.startsWith('/ws/playit/')) {
      const serverId = url.split('/ws/playit/')[1]?.split('?')[0];
      if (serverId) {
        const srv = db.servers.find((s) => s.id === serverId);
        if (!srv) {
          ws.close(4004, 'Server not found');
          return;
        }
        if (user.role !== 'ADMIN' && srv.owner_id !== user.id) {
          ws.close(4003, 'Unauthorized access to server');
          return;
        }

        const streamInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const status = PlayitManager.getStatus(serverId);
            ws.send(JSON.stringify({ type: 'playit_status', data: status }));
          }
        }, 2000);

        ws.on('close', () => {
          clearInterval(streamInterval);
        });
      }
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ZyroCloud] Master Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
