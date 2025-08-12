const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for WebRTC
}));

// CORS middleware
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'spatial-audio-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database
const db = new sqlite3.Database('./spatial_meet.db');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creator_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS room_participants (
    room_id TEXT,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve room page
app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/room.html'));
});

// Socket.io connection handling
const rooms = new Map(); // Store room data

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', (data) => {
    const { roomId, userId, username } = data;
    
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = userId;
    socket.username = username;
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    
    // Add user to room
    rooms.get(roomId).set(socket.id, {
      userId,
      username,
      position: { x: 0, y: 0, z: 0 },
      muted: false
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      username,
      position: { x: 0, y: 0, z: 0 }
    });

    // Send existing users to the new user
    const roomUsers = rooms.get(roomId);
    const existingUsers = [];
    roomUsers.forEach((user, socketId) => {
      if (socketId !== socket.id) {
        existingUsers.push({
          socketId,
          userId: user.userId,
          username: user.username,
          position: user.position,
          muted: user.muted
        });
      }
    });
    
    socket.emit('existing-users', existingUsers);
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      caller: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      answerer: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Handle spatial positioning
  socket.on('position-update', (position) => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const roomUsers = rooms.get(socket.roomId);
      if (roomUsers.has(socket.id)) {
        roomUsers.get(socket.id).position = position;
        
        // Broadcast position to other users in the room
        socket.to(socket.roomId).emit('user-position-update', {
          socketId: socket.id,
          position
        });
      }
    }
  });

  // Handle mute/unmute
  socket.on('toggle-mute', (muted) => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const roomUsers = rooms.get(socket.roomId);
      if (roomUsers.has(socket.id)) {
        roomUsers.get(socket.id).muted = muted;
        
        // Broadcast mute status to other users
        socket.to(socket.roomId).emit('user-mute-update', {
          socketId: socket.id,
          muted
        });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const roomUsers = rooms.get(socket.roomId);
      roomUsers.delete(socket.id);
      
      // If room is empty, delete it
      if (roomUsers.size === 0) {
        rooms.delete(socket.roomId);
      } else {
        // Notify other users in the room
        socket.to(socket.roomId).emit('user-left', {
          socketId: socket.id,
          userId: socket.userId,
          username: socket.username
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Spatial Audio Conferencing Platform running on port ${PORT}`);
});

module.exports = { app, db };