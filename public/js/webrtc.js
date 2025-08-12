// WebRTC Manager for handling peer connections
class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map();
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        this.socket = null;
        this.roomId = null;
        this.userId = null;
        this.username = null;
        this.onRemoteStreamCallback = null;
        this.onUserJoinedCallback = null;
        this.onUserLeftCallback = null;
    }

    async initialize(socket, roomId, userId, username) {
        this.socket = socket;
        this.roomId = roomId;
        this.userId = userId;
        this.username = username;

        try {
            // Get user media (audio only for now, can be extended to video)
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                },
                video: false
            });

            console.log('Local stream obtained');
            this.setupSocketListeners();
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    setupSocketListeners() {
        // Handle offers from other peers
        this.socket.on('offer', async (data) => {
            const { offer, caller } = data;
            await this.handleOffer(offer, caller);
        });

        // Handle answers from other peers
        this.socket.on('answer', async (data) => {
            const { answer, answerer } = data;
            await this.handleAnswer(answer, answerer);
        });

        // Handle ICE candidates
        this.socket.on('ice-candidate', async (data) => {
            const { candidate, sender } = data;
            await this.handleIceCandidate(candidate, sender);
        });

        // Handle new users joining
        this.socket.on('user-joined', async (data) => {
            const { socketId, userId, username, position } = data;
            console.log('User joined:', username);
            
            if (this.onUserJoinedCallback) {
                this.onUserJoinedCallback(data);
            }
            
            // Create peer connection and send offer
            await this.createPeerConnection(socketId);
            await this.sendOffer(socketId);
        });

        // Handle existing users when joining
        this.socket.on('existing-users', async (users) => {
            console.log('Existing users:', users);
            
            for (const user of users) {
                if (this.onUserJoinedCallback) {
                    this.onUserJoinedCallback(user);
                }
                
                // Create peer connection for each existing user
                await this.createPeerConnection(user.socketId);
            }
        });

        // Handle user leaving
        this.socket.on('user-left', (data) => {
            const { socketId, userId, username } = data;
            console.log('User left:', username);
            
            this.removePeerConnection(socketId);
            
            if (this.onUserLeftCallback) {
                this.onUserLeftCallback(data);
            }
        });
    }

    async createPeerConnection(peerId) {
        try {
            const peerConnection = new RTCPeerConnection(this.configuration);
            
            // Add local stream tracks
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            peerConnection.ontrack = (event) => {
                console.log('Received remote stream from:', peerId);
                const [remoteStream] = event.streams;
                
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(peerId, remoteStream);
                }
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        target: peerId,
                        candidate: event.candidate
                    });
                }
            };

            // Handle connection state changes
            peerConnection.onconnectionstatechange = () => {
                console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
            };

            this.peerConnections.set(peerId, peerConnection);
            return peerConnection;
        } catch (error) {
            console.error('Error creating peer connection:', error);
            throw error;
        }
    }

    async sendOffer(peerId) {
        try {
            const peerConnection = this.peerConnections.get(peerId);
            if (!peerConnection) return;

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            this.socket.emit('offer', {
                target: peerId,
                offer: offer
            });
        } catch (error) {
            console.error('Error sending offer:', error);
        }
    }

    async handleOffer(offer, caller) {
        try {
            let peerConnection = this.peerConnections.get(caller);
            
            if (!peerConnection) {
                peerConnection = await this.createPeerConnection(caller);
            }

            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            this.socket.emit('answer', {
                target: caller,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(answer, answerer) {
        try {
            const peerConnection = this.peerConnections.get(answerer);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate, sender) {
        try {
            const peerConnection = this.peerConnections.get(sender);
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    removePeerConnection(peerId) {
        const peerConnection = this.peerConnections.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(peerId);
        }

        // Remove audio element
        const audioElement = document.getElementById(`audio-${peerId}`);
        if (audioElement) {
            audioElement.remove();
        }
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return !audioTrack.enabled; // Return true if muted
            }
        }
        return false;
    }

    setVolume(volume) {
        // Set volume for all remote audio elements
        const audioElements = document.querySelectorAll('audio[id^="audio-"]');
        audioElements.forEach(audio => {
            audio.volume = volume / 100;
        });
    }

    // Set callbacks
    onRemoteStream(callback) {
        this.onRemoteStreamCallback = callback;
    }

    onUserJoined(callback) {
        this.onUserJoinedCallback = callback;
    }

    onUserLeft(callback) {
        this.onUserLeftCallback = callback;
    }

    // Cleanup
    disconnect() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        this.peerConnections.forEach((peerConnection, peerId) => {
            this.removePeerConnection(peerId);
        });

        this.peerConnections.clear();
    }
}