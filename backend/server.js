// backend/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Store push subscriptions
let subscriptions = [];

// VAPID keys for web-push (generate your own for production)
const publicVapidKey = 'BHkdRiZFoaD9AnDAr_PRG2WhoWAaey6a3AWeCjRS18PCdXlN3j4COszFjGUbG58VXcYivUyg3DHOrBvjSfpo3-U';
const privateVapidKey = 'ga705Guq6I1rYNIo-3aO33IqTQt6sMaxVO5Cl8HaxAE';
webpush.setVapidDetails(
  'mailto:your@email.com',
  publicVapidKey,
  privateVapidKey
);

// Endpoint to save push subscription
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({ message: 'Subscription saved' });
});

// Example endpoint to trigger notification (admin approve)
app.post('/notify', async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({ title, body });
  // Send push notification to all subscribers
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(err));
  });
  // Also emit real-time event via socket.io
  io.emit('notification', { title, body });
  res.json({ message: 'Notification sent' });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('user-action', (data) => {
    // Example: user requests something
    io.emit('notification', { title: 'User Action', body: data });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
