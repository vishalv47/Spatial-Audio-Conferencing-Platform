const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const db = new sqlite3.Database('./spatial_meet.db');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Create a new room
router.post('/create', requireAuth, (req, res) => {
  const { name } = req.body;
  const roomId = uuidv4();
  const creatorId = req.session.userId;

  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  db.run(
    'INSERT INTO rooms (id, name, creator_id) VALUES (?, ?, ?)',
    [roomId, name, creatorId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create room' });
      }

      res.json({
        success: true,
        room: {
          id: roomId,
          name,
          creatorId
        }
      });
    }
  );
});

// Get room information
router.get('/:roomId', (req, res) => {
  const { roomId } = req.params;

  db.get(
    'SELECT r.*, u.username as creator_name FROM rooms r LEFT JOIN users u ON r.creator_id = u.id WHERE r.id = ?',
    [roomId],
    (err, room) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json({
        success: true,
        room: {
          id: room.id,
          name: room.name,
          creatorId: room.creator_id,
          creatorName: room.creator_name,
          createdAt: room.created_at
        }
      });
    }
  );
});

// Join a room
router.post('/:roomId/join', requireAuth, (req, res) => {
  const { roomId } = req.params;
  const userId = req.session.userId;

  // First check if room exists
  db.get('SELECT * FROM rooms WHERE id = ?', [roomId], (err, room) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is already in the room
    db.get(
      'SELECT * FROM room_participants WHERE room_id = ? AND user_id = ?',
      [roomId, userId],
      (err, participant) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (participant) {
          return res.json({
            success: true,
            message: 'Already in room',
            room: {
              id: room.id,
              name: room.name
            }
          });
        }

        // Add user to room
        db.run(
          'INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)',
          [roomId, userId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to join room' });
            }

            res.json({
              success: true,
              message: 'Joined room successfully',
              room: {
                id: room.id,
                name: room.name
              }
            });
          }
        );
      }
    );
  });
});

// Leave a room
router.post('/:roomId/leave', requireAuth, (req, res) => {
  const { roomId } = req.params;
  const userId = req.session.userId;

  db.run(
    'DELETE FROM room_participants WHERE room_id = ? AND user_id = ?',
    [roomId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        message: 'Left room successfully'
      });
    }
  );
});

// Get user's rooms
router.get('/user/rooms', requireAuth, (req, res) => {
  const userId = req.session.userId;

  db.all(
    `SELECT DISTINCT r.id, r.name, r.created_at, u.username as creator_name
     FROM rooms r
     LEFT JOIN users u ON r.creator_id = u.id
     LEFT JOIN room_participants rp ON r.id = rp.room_id
     WHERE r.creator_id = ? OR rp.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId, userId],
    (err, rooms) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        rooms
      });
    }
  );
});

module.exports = router;