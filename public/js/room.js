// Room management and spatial visualization
class RoomManager {
    constructor() {
        this.socket = null;
        this.webrtcManager = null;
        this.spatialAudioManager = null;
        this.roomId = null;
        this.currentUser = null;
        this.participants = new Map();
        this.canvas = null;
        this.ctx = null;
        this.isDragging = false;
        this.userPosition = { x: 0, y: 0, z: 0 };
        this.isMuted = false;
        this.spatialEnabled = true;
    }

    async initialize() {
        try {
            // Extract room ID from URL
            this.roomId = window.location.pathname.split('/')[2];
            
            // Check authentication
            const authResponse = await fetch('/api/auth/status');
            const authData = await authResponse.json();
            
            if (!authData.authenticated) {
                window.location.href = '/';
                return;
            }
            
            this.currentUser = authData.user;
            
            // Get room information
            const roomResponse = await fetch(`/api/rooms/${this.roomId}`);
            const roomData = await roomResponse.json();
            
            if (!roomData.success) {
                this.showMessage('Room not found', 'error');
                setTimeout(() => window.location.href = '/', 3000);
                return;
            }
            
            // Update UI with room info
            document.getElementById('room-name').textContent = roomData.room.name;
            document.getElementById('room-id').textContent = `Room ID: ${this.roomId}`;
            
            // Initialize components
            await this.initializeCanvas();
            await this.initializeSpatialAudio();
            await this.initializeWebRTC();
            await this.initializeSocket();
            
            this.setupEventListeners();
            this.updateConnectionStatus('Connected', 'success');
            
            console.log('Room initialized successfully');
        } catch (error) {
            console.error('Error initializing room:', error);
            this.showMessage('Failed to initialize room', 'error');
        }
    }

    async initializeCanvas() {
        this.canvas = document.getElementById('spatial-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Initial render
        this.renderSpatialView();
    }

    async initializeSpatialAudio() {
        this.spatialAudioManager = new SpatialAudioManager();
        await this.spatialAudioManager.initialize();
    }

    async initializeWebRTC() {
        this.webrtcManager = new WebRTCManager();
        
        // Set up callbacks
        this.webrtcManager.onRemoteStream((peerId, stream) => {
            this.handleRemoteStream(peerId, stream);
        });
        
        this.webrtcManager.onUserJoined((userData) => {
            this.addParticipant(userData);
        });
        
        this.webrtcManager.onUserLeft((userData) => {
            this.removeParticipant(userData.socketId);
        });
    }

    async initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            
            // Join the room
            this.socket.emit('join-room', {
                roomId: this.roomId,
                userId: this.currentUser.id,
                username: this.currentUser.username
            });
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected', 'error');
        });
        
        this.socket.on('user-position-update', (data) => {
            const { socketId, position } = data;
            this.updateParticipantPosition(socketId, position);
        });
        
        this.socket.on('user-mute-update', (data) => {
            const { socketId, muted } = data;
            this.updateParticipantMuteStatus(socketId, muted);
        });
        
        // Initialize WebRTC with socket
        await this.webrtcManager.initialize(
            this.socket,
            this.roomId,
            this.currentUser.id,
            this.currentUser.username
        );
    }

    setupEventListeners() {
        // Canvas mouse events for position dragging
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.onTouchEnd());
        
        // Audio controls
        document.getElementById('mute-btn').addEventListener('click', () => this.toggleMute());
        document.getElementById('volume-slider').addEventListener('input', (e) => this.setVolume(e.target.value));
        document.getElementById('spatial-toggle').addEventListener('click', () => this.toggleSpatialAudio());
        document.getElementById('leave-room-btn').addEventListener('click', () => this.leaveRoom());
        
        // Volume slider display
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            document.getElementById('volume-value').textContent = `${e.target.value}%`;
        });
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if click is near user position
        const userCanvasPos = this.spatialAudioManager && this.spatialAudioManager.worldToCanvasPosition ? 
            this.spatialAudioManager.worldToCanvasPosition(
                this.userPosition.x, this.userPosition.y, this.userPosition.z,
                this.canvas.width, this.canvas.height
            ) : { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        
        const distance = Math.sqrt(Math.pow(x - userCanvasPos.x, 2) + Math.pow(y - userCanvasPos.y, 2));
        
        if (distance < 20) {
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
        }
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.updateUserPosition(x, y);
        }
    }

    onMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }

    onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }

    onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    onTouchEnd() {
        this.onMouseUp();
    }

    updateUserPosition(canvasX, canvasY) {
        // Convert canvas coordinates to world position
        if (this.spatialAudioManager && this.spatialAudioManager.canvasToWorldPosition) {
            this.userPosition = this.spatialAudioManager.canvasToWorldPosition(
                canvasX, canvasY, this.canvas.width, this.canvas.height
            );
            
            // Update spatial audio listener position
            this.spatialAudioManager.setListenerPosition(
                this.userPosition.x, this.userPosition.y, this.userPosition.z
            );
        }
        
        // Send position update to other users
        this.socket.emit('position-update', this.userPosition);
        
        // Re-render canvas
        this.renderSpatialView();
    }

    addParticipant(userData) {
        this.participants.set(userData.socketId, {
            userId: userData.userId,
            username: userData.username,
            position: userData.position || { x: 0, y: 0, z: 0 },
            muted: userData.muted || false,
            color: this.generateParticipantColor(userData.userId)
        });
        
        this.updateParticipantsList();
        this.renderSpatialView();
    }

    removeParticipant(socketId) {
        this.participants.delete(socketId);
        this.spatialAudioManager.removeAudioSource(socketId);
        this.updateParticipantsList();
        this.renderSpatialView();
    }

    updateParticipantPosition(socketId, position) {
        const participant = this.participants.get(socketId);
        if (participant) {
            participant.position = position;
            this.spatialAudioManager.updateAudioSourcePosition(socketId, position);
            this.renderSpatialView();
        }
    }

    updateParticipantMuteStatus(socketId, muted) {
        const participant = this.participants.get(socketId);
        if (participant) {
            participant.muted = muted;
            this.updateParticipantsList();
            this.renderSpatialView();
        }
    }

    handleRemoteStream(peerId, stream) {
        // Create audio element for the remote stream
        const audioElement = document.createElement('audio');
        audioElement.id = `audio-${peerId}`;
        audioElement.srcObject = stream;
        audioElement.autoplay = true;
        audioElement.controls = false;
        
        // Add to audio elements container
        document.getElementById('audio-elements').appendChild(audioElement);
        
        // Add to spatial audio manager
        audioElement.addEventListener('canplay', () => {
            this.spatialAudioManager.resumeContext();
            this.spatialAudioManager.addAudioSource(peerId, audioElement);
            
            // Set initial position if participant exists
            const participant = this.participants.get(peerId);
            if (participant) {
                this.spatialAudioManager.updateAudioSourcePosition(peerId, participant.position);
            }
        });
    }

    toggleMute() {
        this.isMuted = this.webrtcManager.toggleMute();
        
        // Update UI
        const muteIcon = document.getElementById('mute-icon');
        const muteText = document.getElementById('mute-text');
        
        if (this.isMuted) {
            muteIcon.textContent = '🔇';
            muteText.textContent = 'Unmute';
            document.getElementById('mute-btn').classList.add('btn-danger');
            document.getElementById('mute-btn').classList.remove('btn-primary');
        } else {
            muteIcon.textContent = '🎤';
            muteText.textContent = 'Mute';
            document.getElementById('mute-btn').classList.add('btn-primary');
            document.getElementById('mute-btn').classList.remove('btn-danger');
        }
        
        // Notify other users
        this.socket.emit('toggle-mute', this.isMuted);
    }

    setVolume(volume) {
        this.spatialAudioManager.setMasterVolume(volume / 100);
    }

    toggleSpatialAudio() {
        this.spatialEnabled = this.spatialAudioManager.toggleSpatialAudio();
        
        const spatialText = document.getElementById('spatial-text');
        spatialText.textContent = `3D Audio: ${this.spatialEnabled ? 'ON' : 'OFF'}`;
    }

    renderSpatialView() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw user position (blue circle)
        const userCanvasPos = this.spatialAudioManager && this.spatialAudioManager.worldToCanvasPosition ? 
            this.spatialAudioManager.worldToCanvasPosition(
                this.userPosition.x, this.userPosition.y, this.userPosition.z,
                this.canvas.width, this.canvas.height
            ) : { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        
        this.ctx.fillStyle = '#007bff';
        this.ctx.beginPath();
        this.ctx.arc(userCanvasPos.x, userCanvasPos.y, 15, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw user label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('You', userCanvasPos.x, userCanvasPos.y + 4);
        
        // Draw other participants
        this.participants.forEach((participant, socketId) => {
            const canvasPos = this.spatialAudioManager && this.spatialAudioManager.worldToCanvasPosition ? 
                this.spatialAudioManager.worldToCanvasPosition(
                    participant.position.x, participant.position.y, participant.position.z,
                    this.canvas.width, this.canvas.height
                ) : { x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height };
            
            // Draw participant circle
            this.ctx.fillStyle = participant.muted ? '#666' : participant.color;
            this.ctx.beginPath();
            this.ctx.arc(canvasPos.x, canvasPos.y, 12, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Draw mute indicator
            if (participant.muted) {
                this.ctx.fillStyle = 'red';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('🔇', canvasPos.x, canvasPos.y + 3);
            }
            
            // Draw participant name
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(participant.username, canvasPos.x, canvasPos.y + 25);
        });
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    generateParticipantColor(userId) {
        // Generate a consistent color based on user ID
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffd93d', '#6c5ce7', '#fd79a8', '#00b894', '#e17055'];
        return colors[userId % colors.length];
    }

    updateParticipantsList() {
        const participantsList = document.getElementById('participants-list');
        const participantCount = document.getElementById('participant-count');
        
        participantCount.textContent = this.participants.size + 1; // +1 for current user
        
        participantsList.innerHTML = `
            <div class="participant-item">
                <span class="participant-name">${this.currentUser.username} (You)</span>
                <span class="participant-status ${this.isMuted ? 'muted' : 'unmuted'}">${this.isMuted ? 'Muted' : 'Active'}</span>
            </div>
        `;
        
        this.participants.forEach((participant, socketId) => {
            const participantItem = document.createElement('div');
            participantItem.className = 'participant-item';
            participantItem.innerHTML = `
                <span class="participant-name">${participant.username}</span>
                <span class="participant-status ${participant.muted ? 'muted' : 'unmuted'}">${participant.muted ? 'Muted' : 'Active'}</span>
            `;
            participantsList.appendChild(participantItem);
        });
    }

    updateConnectionStatus(status, type) {
        const statusText = document.getElementById('status-text');
        statusText.textContent = status;
        statusText.className = type;
    }

    showMessage(text, type = 'info') {
        const messageElement = document.getElementById('message');
        messageElement.textContent = text;
        messageElement.className = `message ${type}`;
        messageElement.classList.remove('hidden');
        
        setTimeout(() => {
            messageElement.classList.add('hidden');
        }, 5000);
    }

    async leaveRoom() {
        try {
            await fetch(`/api/rooms/${this.roomId}/leave`, { method: 'POST' });
            
            // Cleanup
            this.webrtcManager.disconnect();
            this.spatialAudioManager.dispose();
            this.socket.disconnect();
            
            // Redirect to main page
            window.location.href = '/';
        } catch (error) {
            console.error('Error leaving room:', error);
            window.location.href = '/';
        }
    }
}

// Initialize room when page loads
document.addEventListener('DOMContentLoaded', async () => {
    const roomManager = new RoomManager();
    await roomManager.initialize();
});