// Spatial Audio Manager for 3D positioning of audio sources
class SpatialAudioManager {
    constructor() {
        this.audioContext = null;
        this.listener = null;
        this.audioSources = new Map();
        this.isEnabled = true;
        this.masterGainNode = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node for overall volume control
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            
            // Get the listener (represents the user's ears)
            this.listener = this.audioContext.listener;
            
            // Set up default listener orientation and position
            if (this.listener.forwardX) {
                // Modern API
                this.listener.forwardX.value = 0;
                this.listener.forwardY.value = 0;
                this.listener.forwardZ.value = -1;
                this.listener.upX.value = 0;
                this.listener.upY.value = 1;
                this.listener.upZ.value = 0;
            } else if (this.listener.setOrientation) {
                // Legacy API
                this.listener.setOrientation(0, 0, -1, 0, 1, 0);
            }
            
            this.setListenerPosition(0, 0, 0);
            this.initialized = true;
            
            console.log('Spatial audio initialized');
            return true;
        } catch (error) {
            console.error('Error initializing spatial audio:', error);
            this.initialized = false;
            return false;
        }
    }

    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    addAudioSource(peerId, audioElement) {
        if (!this.initialized || !this.isEnabled) {
            return false;
        }

        try {
            // Create audio source from audio element
            const source = this.audioContext.createMediaElementSource(audioElement);
            
            // Create panner node for 3D positioning
            const panner = this.audioContext.createPanner();
            
            // Configure panner properties
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = 10000;
            panner.rolloffFactor = 1;
            panner.coneInnerAngle = 360;
            panner.coneOuterAngle = 0;
            panner.coneOuterGain = 0;

            // Create gain node for individual volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.5; // Default volume

            // Connect the audio graph: source -> panner -> gain -> master -> destination
            source.connect(panner);
            panner.connect(gainNode);
            gainNode.connect(this.masterGainNode);

            // Store the audio source data
            this.audioSources.set(peerId, {
                source,
                panner,
                gainNode,
                audioElement,
                position: { x: 0, y: 0, z: 0 }
            });

            console.log('Added spatial audio source for peer:', peerId);
            return true;
        } catch (error) {
            console.error('Error adding audio source:', error);
            return false;
        }
    }

    removeAudioSource(peerId) {
        const sourceData = this.audioSources.get(peerId);
        if (sourceData) {
            try {
                sourceData.source.disconnect();
                sourceData.panner.disconnect();
                sourceData.gainNode.disconnect();
            } catch (error) {
                console.error('Error disconnecting audio source:', error);
            }
            
            this.audioSources.delete(peerId);
            console.log('Removed spatial audio source for peer:', peerId);
        }
    }

    updateAudioSourcePosition(peerId, position) {
        const sourceData = this.audioSources.get(peerId);
        if (sourceData && this.isEnabled) {
            const { x, y, z } = position;
            
            // Update position in the panner
            if (sourceData.panner.positionX) {
                // Modern API
                sourceData.panner.positionX.value = x;
                sourceData.panner.positionY.value = y;
                sourceData.panner.positionZ.value = z;
            } else if (sourceData.panner.setPosition) {
                // Legacy API
                sourceData.panner.setPosition(x, y, z);
            }
            
            sourceData.position = { x, y, z };
            
            // Calculate distance for volume adjustment
            const distance = Math.sqrt(x * x + y * y + z * z);
            const volumeMultiplier = Math.max(0.1, Math.min(1, 1 / (1 + distance * 0.1)));
            
            sourceData.gainNode.gain.value = 0.5 * volumeMultiplier;
        }
    }

    setListenerPosition(x, y, z) {
        if (!this.listener) return;
        
        if (this.listener.positionX) {
            // Modern API
            this.listener.positionX.value = x;
            this.listener.positionY.value = y;
            this.listener.positionZ.value = z;
        } else if (this.listener.setPosition) {
            // Legacy API
            this.listener.setPosition(x, y, z);
        }
    }

    setListenerOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ) {
        if (!this.listener) return;
        
        if (this.listener.forwardX) {
            // Modern API
            this.listener.forwardX.value = forwardX;
            this.listener.forwardY.value = forwardY;
            this.listener.forwardZ.value = forwardZ;
            this.listener.upX.value = upX;
            this.listener.upY.value = upY;
            this.listener.upZ.value = upZ;
        } else if (this.listener.setOrientation) {
            // Legacy API
            this.listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
        }
    }

    setMasterVolume(volume) {
        if (this.masterGainNode) {
            this.masterGainNode.gain.value = volume;
        }
    }

    setSourceVolume(peerId, volume) {
        const sourceData = this.audioSources.get(peerId);
        if (sourceData) {
            sourceData.gainNode.gain.value = volume;
        }
    }

    toggleSpatialAudio() {
        this.isEnabled = !this.isEnabled;
        
        if (!this.isEnabled) {
            // Disable spatial audio by setting all positions to center
            this.audioSources.forEach((sourceData, peerId) => {
                this.updateAudioSourcePosition(peerId, { x: 0, y: 0, z: 0 });
            });
        } else {
            // Re-enable spatial audio by restoring positions
            this.audioSources.forEach((sourceData, peerId) => {
                this.updateAudioSourcePosition(peerId, sourceData.position);
            });
        }
        
        return this.isEnabled;
    }

    // Convert 2D canvas coordinates to 3D world coordinates
    canvasToWorldPosition(canvasX, canvasY, canvasWidth, canvasHeight) {
        // Normalize canvas coordinates to [-1, 1] range
        const x = (canvasX / canvasWidth) * 2 - 1;
        const z = (canvasY / canvasHeight) * 2 - 1;
        const y = 0; // Keep y at 0 for 2D positioning
        
        // Scale to reasonable world units
        return {
            x: x * 10,
            y: y,
            z: z * 10
        };
    }

    // Convert world coordinates back to canvas coordinates
    worldToCanvasPosition(worldX, worldY, worldZ, canvasWidth, canvasHeight) {
        // Scale down from world units
        const x = worldX / 10;
        const z = worldZ / 10;
        
        // Convert from [-1, 1] range to canvas coordinates
        const canvasX = (x + 1) * canvasWidth / 2;
        const canvasY = (z + 1) * canvasHeight / 2;
        
        return { x: canvasX, y: canvasY };
    }

    // Get audio source information
    getAudioSourceInfo(peerId) {
        return this.audioSources.get(peerId);
    }

    // Get all audio sources
    getAllAudioSources() {
        return Array.from(this.audioSources.entries());
    }

    // Cleanup
    dispose() {
        this.audioSources.forEach((sourceData, peerId) => {
            this.removeAudioSource(peerId);
        });
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.initialized = false;
    }
}