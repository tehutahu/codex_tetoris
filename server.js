const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

function createGameServer({ staticDirectory = path.join(__dirname, 'client', 'dist') } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  app.use(express.static(staticDirectory));

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticDirectory, 'index.html'));
  });

  io.on('connection', socket => {
    socket.on('state', state => {
      socket.broadcast.emit('state', state);
    });
  });
  return { app, server, io };
}

if (require.main === module) {
  const { server } = createGameServer();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`Server listening on http://localhost:${server.address().port}`);
  });
}

module.exports = { createGameServer };
