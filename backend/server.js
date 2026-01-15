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

// Sob subscriber ke notification pathanor function
function sendNotificationToAll(title, body) {
  const payload = JSON.stringify({ title, body });
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(err));
  });
  io.emit('notification', { title, body });
}

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
  sendNotificationToAll(title, body);
  res.json({ message: 'Notification sent' });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('user-action', (data) => {
    // Example: user requests something
    sendNotificationToAll('User Action', data);
  });
});


// --- Firebase Listener for Auto Notification ---
try {
  const { initializeApp } = require('firebase/app');
  const { getDatabase, ref, onChildAdded } = require('firebase/database');

  // Firebase config (replace with your own)
  const firebaseConfig = {
    apiKey: "AIzaSyDyU5WvIvsSiH78akJ3GABeTKUa_bOq5-k",
    authDomain: "bmdsss-savings-5edad.firebaseapp.com",
    databaseURL: "https://bmdsss-savings-5edad-default-rtdb.firebaseio.com",
    projectId: "bmdsss-savings-5edad",
    storageBucket: "bmdsss-savings-5edad.firebasestorage.app",
    messagingSenderId: "639379436871",
    appId: "1:639379436871:web:b9eb965d6ad5b5f73b8862"
  };

  const appFB = initializeApp(firebaseConfig);
  const db = getDatabase(appFB);
  const requestsRef = ref(db, 'requests');

  onChildAdded(requestsRef, (snapshot) => {
    const request = snapshot.val();
    // Notification title & body
    const title = 'নতুন একাউন্ট/টাকা রিকোয়েস্ট';
    const body = `${request.name || 'User'} নতুন রিকোয়েস্ট পাঠিয়েছে!`;
    sendNotificationToAll(title, body);
  });
  console.log('Firebase listener for requests enabled.');
} catch (err) {
  console.error('Firebase listener setup failed:', err);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
