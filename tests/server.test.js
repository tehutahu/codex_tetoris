const request = require('supertest');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

describe('server', () => {
  test('serves index.html', async () => {
    const app = express();
    const httpServer = createServer(app);
    new Server(httpServer); // eslint-disable-line no-new
    app.use(express.static(path.join(__dirname, '..', 'client')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'index.html')));

    await new Promise((resolve) => httpServer.listen(() => resolve()));
    const res = await request(httpServer).get('/');
    expect(res.status).toBe(200);
    httpServer.close();
  });
});
