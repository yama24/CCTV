class CCTVCamera {
    constructor() {
        this.socket = io();
        this.localVideo = document.getElementById('localVideo');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.status = document.getElementById('status');
        this.cameraNameInput = document.getElementById('cameraName');
        this.deviceInfoInput = document.getElementById('deviceInfo');
        
        this.localStream = null;
        this.peerConnections = new Map(); // Store multiple connections for multiple viewers
        this.roomId = null; // Will be generated based on camera name
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.initializeDefaults();
    }

    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
    }

    initializeDefaults() {
        // Set default values
        const defaultCameraName = `Camera-${Math.random().toString(36).substr(2, 5)}`;
        this.cameraNameInput.value = defaultCameraName;
        
        // Try to detect device info
        const userAgent = navigator.userAgent;
        let deviceInfo = 'Unknown Device';
        if (userAgent.includes('Mobile')) {
            deviceInfo = 'Mobile Device';
        } else if (userAgent.includes('Tablet')) {
            deviceInfo = 'Tablet';
        } else {
            deviceInfo = 'Desktop/Laptop';
        }
        this.deviceInfoInput.value = deviceInfo;
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('🔌 Connected to server', 'connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('📴 Disconnected from server', 'disconnected');
        });

        this.socket.on('viewer-requesting-offer', (data) => {
            console.log('Viewer requesting offer:', data.viewerId);
            this.createOfferForViewer(data.viewerId);
        });

        this.socket.on('answer', (data) => {
            console.log('Received answer from viewer');
            this.handleAnswer(data.answer, data.sender);
        });

        this.socket.on('ice-candidate', (data) => {
            console.log('Received ICE candidate from viewer');
            this.handleIceCandidate(data.candidate, data.sender);
        });
    }

    async startCamera() {
        try {
            // Validate inputs
            const cameraName = this.cameraNameInput.value.trim();
            const deviceInfo = this.deviceInfoInput.value.trim();
            
            if (!cameraName) {
                this.updateStatus('❌ Please enter a camera name', 'disconnected');
                return;
            }

            // Generate unique room ID based on camera name and timestamp
            this.roomId = `camera-${cameraName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${Date.now()}`;
            
            this.updateStatus('📷 Starting camera...', 'disconnected');
            
            // Get user media with both video and audio
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.localVideo.srcObject = this.localStream;
            
            // Join the room as a camera with metadata
            this.socket.emit('join-room', {
                roomId: this.roomId,
                role: 'camera',
                cameraName: cameraName,
                deviceInfo: deviceInfo
            });

            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.cameraNameInput.disabled = true;
            this.deviceInfoInput.disabled = true;
            this.updateStatus(`📺 "${cameraName}" active - Ready for viewers`, 'connected');

        } catch (error) {
            console.error('Error starting camera:', error);
            this.updateStatus('❌ Error starting camera: ' + error.message, 'disconnected');
        }
    }

    stopCamera() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.localVideo.srcObject = null;
        
        // Close all peer connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();

        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.cameraNameInput.disabled = false;
        this.deviceInfoInput.disabled = false;
        this.updateStatus('📴 Camera stopped', 'disconnected');
    }

    async createOfferForViewer(viewerId) {
        try {
            if (!this.localStream) {
                console.error('No local stream available');
                return;
            }

            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnections.set(viewerId, peerConnection);

            // Add local stream tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        target: viewerId,
                        candidate: event.candidate
                    });
                }
            };

            // Handle connection state changes
            peerConnection.onconnectionstatechange = () => {
                console.log(`Connection state with ${viewerId}:`, peerConnection.connectionState);
                if (peerConnection.connectionState === 'connected') {
                    this.updateStatus('📡 Streaming to viewer', 'connected');
                } else if (peerConnection.connectionState === 'disconnected' || 
                          peerConnection.connectionState === 'failed') {
                    this.peerConnections.delete(viewerId);
                }
            };

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            this.socket.emit('offer', {
                target: viewerId,
                offer: offer
            });

            console.log('Offer sent to viewer:', viewerId);

        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleAnswer(answer, senderId) {
        try {
            const peerConnection = this.peerConnections.get(senderId);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(answer);
                console.log('Answer processed for viewer:', senderId);
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate, senderId) {
        try {
            const peerConnection = this.peerConnections.get(senderId);
            if (peerConnection) {
                await peerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    updateStatus(message, type) {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }
}

// Initialize the camera when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CCTVCamera();
});