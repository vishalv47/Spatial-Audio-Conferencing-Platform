# AudioMeet - Audio Conferencing Platform

AudioMeet is a comprehensive audio conferencing platform that enables immersive audio experiences through 3D positioning, WebRTC integration, and real-time user management.

## Features

### 🎯 Core Features
- **Audio Technology**: Experience 3D positioned audio using Web Audio API
- **Real-time Communication**: WebRTC-powered peer-to-peer audio streaming
- **User Management**: Complete authentication system with registration and login
- **Room-based Conferencing**: Create and join conference rooms with persistent data
- **Interactive Positioning**: Visual 2D canvas for positioning users in 3D space
- **Audio Controls**: Mute/unmute, volume control, and spatial audio toggle

### 🛠️ Technical Features
- **SQLite Database**: Persistent user and room data storage
- **Socket.IO Integration**: Real-time signaling and position updates
- **Responsive Design**: Mobile-friendly interface
- **Security**: Password hashing, session management, and CORS protection
- **Modern Web APIs**: Latest WebRTC, Web Audio API, and Canvas technologies

## Architecture

### Backend
- **Node.js** with Express.js framework
- **Socket.IO** for real-time communication
- **SQLite3** database for data persistence
- **bcryptjs** for password security
- **Express sessions** for authentication

### Frontend
- **HTML5/CSS3** responsive design
- **Vanilla JavaScript** for optimal performance
- **Canvas API** for spatial visualization
- **Web Audio API** for 3D audio processing
- **WebRTC** for peer-to-peer connections

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Spatial-Audio-Conferencing-Platform
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

### Development Mode
For development with auto-reload:
```bash
npm run dev
```

## Usage Guide

### 1. User Registration/Login
- Navigate to the main page
- Register a new account or login with existing credentials
- Secure authentication with password hashing

### 2. Room Management
- **Create Room**: Enter a room name and click "Create Room"
- **Join Room**: Enter a room ID to join an existing room
- **View Rooms**: See all rooms you've created or joined

### 3. Conference Experience
- **Position Control**: Click and drag on the canvas to move your position
- **Audio Controls**: Use mute/unmute button and volume slider
- **Audio**: Toggle 3D audio on/off
- **Participant View**: See other users' positions and mute status

### 4. Real-time Features
- Live position updates for all participants
- Real-time mute/unmute status synchronization
- Automatic WebRTC connection management

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/status` - Check authentication status

### Room Management Endpoints
- `POST /api/rooms/create` - Create a new room
- `GET /api/rooms/:roomId` - Get room information
- `POST /api/rooms/:roomId/join` - Join a room
- `POST /api/rooms/:roomId/leave` - Leave a room
- `GET /api/rooms/user/rooms` - Get user's rooms

### WebSocket Events
- `join-room` - Join a conference room
- `position-update` - Update user position
- `toggle-mute` - Toggle mute status
- `offer/answer/ice-candidate` - WebRTC signaling

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creator_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users (id)
);
```

### Room Participants Table
```sql
CREATE TABLE room_participants (
    room_id TEXT,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend Framework | Express.js | Web server and API |
| Real-time Communication | Socket.IO | WebSocket connections |
| Database | SQLite3 | Data persistence |
| Authentication | bcryptjs + express-session | Security |
| WebRTC | Native Browser APIs | P2P audio streaming |
| Spatial Audio | Web Audio API | 3D audio positioning |
| Frontend | HTML5/CSS3/JavaScript | User interface |
| Security | Helmet.js + CORS | Protection middleware |

## Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **Session Management**: Secure session cookies
- **CORS Protection**: Configured for secure origins
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries

## Browser Compatibility

### Required Browser Features
- WebRTC support (Chrome 23+, Firefox 22+, Safari 11+)
- Web Audio API (Chrome 14+, Firefox 23+, Safari 6+)
- Canvas API (All modern browsers)
- WebSocket support (All modern browsers)

### Recommended Browsers
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Performance Considerations

- **Efficient WebRTC**: Optimized peer connection management
- **Canvas Optimization**: Selective rendering for smooth visualization
- **Audio Processing**: Efficient spatial audio calculations
- **Memory Management**: Proper cleanup of connections and contexts

## Troubleshooting

### Common Issues

1. **Audio Not Working**:
   - Ensure microphone permissions are granted
   - Check browser audio settings
   - Verify WebRTC compatibility

2. **Connection Issues**:
   - Check firewall settings
   - Verify STUN server connectivity
   - Ensure WebSocket connections are allowed

3. **Database Errors**:
   - Verify SQLite file permissions
   - Check disk space availability
   - Ensure proper database initialization

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=* npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Future Enhancements

- [ ] Video conferencing support
- [ ] Advanced spatial audio algorithms
- [ ] Screen sharing capabilities
- [ ] Recording functionality
- [ ] Advanced room management features
- [ ] Mobile app development
- [ ] Integration with external calendar systems
- [ ] Advanced analytics and reporting

## Support

For support, issues, or feature requests, please create an issue in the repository or contact the development team.

---

Built with ❤️ using modern web technologies for immersive audio experiences.
