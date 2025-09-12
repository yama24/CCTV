class CCTVViewer {
    constructor() {
        this.socket = io();
        this.remoteVideo = document.getElementById('remoteVideo');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.refreshBtn = document.getElementById('refreshCameras');
        this.status = document.getElementById('status');
        this.cameraList = document.getElementById('cameraList');
        this.viewingInfo = document.getElementById('viewingInfo');
        this.currentCameraName = document.getElementById('currentCameraName');
        this.videoPlaceholder = document.getElementById('videoPlaceholder');
        
        this.peerConnection = null;
        this.currentCamera = null;
        this.availableCameras = [];
        this.isConnected = false;
        this.isConnecting = false;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.loadCameras();
    }

    initializeEventListeners() {
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.refreshBtn.addEventListener('click', () => this.loadCameras());
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('🔌 Connected - Click any camera to view', 'connected');
            this.loadCameras();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('📴 Disconnected from server', 'disconnected');
            this.isConnected = false;
            this.isConnecting = false;
        });

        this.socket.on('cameras-updated', (cameras) => {
            console.log('Camera list updated:', cameras);
            this.availableCameras = cameras;
            this.renderCameraList();
        });

        this.socket.on('camera-available', () => {
            console.log('Selected camera is available');
        });

        this.socket.on('camera-disconnected', () => {
            console.log('Selected camera disconnected');
            this.updateStatus('📴 Selected camera disconnected', 'disconnected');
            this.disconnect();
            this.loadCameras();
        });

        this.socket.on('offer', (data) => {
            console.log('Received offer from camera');
            this.handleOffer(data.offer, data.sender);
        });

        this.socket.on('ice-candidate', (data) => {
            console.log('Received ICE candidate from camera');
            this.handleIceCandidate(data.candidate);
        });
    }

    async loadCameras() {
        try {
            const response = await fetch('/api/cameras');
            const cameras = await response.json();
            this.availableCameras = cameras;
            this.renderCameraList();
        } catch (error) {
            console.error('Error loading cameras:', error);
            this.cameraList.innerHTML = '<div class="error">❌ Error loading camera list</div>';
        }
    }

    renderCameraList() {
        if (this.availableCameras.length === 0) {
            this.cameraList.innerHTML = `
                <div class="info">
                    📵 No cameras available<br>
                    <small>Start a camera on any device to see it here</small>
                </div>
            `;
            return;
        }

        this.cameraList.innerHTML = this.availableCameras.map(camera => {
            const isViewing = this.currentCamera?.roomId === camera.roomId && this.isConnected;
            const isConnecting = this.currentCamera?.roomId === camera.roomId && this.isConnecting;
            
            let statusClass = 'available';
            let statusIcon = '🟢';
            let statusText = 'LIVE - Click to view';
            
            if (isViewing) {
                statusClass = 'viewing';
                statusIcon = '📺';
                statusText = 'VIEWING NOW';
            } else if (isConnecting) {
                statusClass = 'connecting';
                statusIcon = '🔄';
                statusText = 'CONNECTING...';
            }
            
            return `
                <div class="camera-item ${statusClass}" data-room-id="${camera.roomId}">
                    <div class="camera-name">📹 ${camera.name}</div>
                    <div class="camera-details">
                        <span class="camera-status ${statusClass}">${statusIcon} ${statusText}</span><br>
                        📱 ${camera.deviceInfo}<br>
                        🕒 Connected: ${new Date(camera.connectedAt).toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        this.cameraList.querySelectorAll('.camera-item').forEach(item => {
            item.addEventListener('click', () => {
                const roomId = item.dataset.roomId;
                this.viewCamera(roomId);
            });
        });
    }

    viewCamera(roomId) {
        const camera = this.availableCameras.find(c => c.roomId === roomId);
        if (!camera) return;

        // If already viewing this camera, do nothing
        if (this.currentCamera?.roomId === roomId && this.isConnected) {
            return;
        }

        // If currently connecting to this camera, do nothing
        if (this.currentCamera?.roomId === roomId && this.isConnecting) {
            return;
        }

        // Disconnect from current camera if connected or connecting
        if (this.isConnected || this.isConnecting) {
            this.disconnect();
        }

        // Start connecting to new camera
        this.currentCamera = camera;
        this.isConnecting = true;
        this.currentCameraName.textContent = camera.name;
        this.viewingInfo.style.display = 'block';
        this.videoPlaceholder.style.display = 'none';
        
        this.renderCameraList(); // Update visual state
        this.updateStatus(`🔄 Connecting to ${camera.name}...`, 'disconnected');
        
        // Join the room as a viewer
        this.socket.emit('join-room', {
            roomId: camera.roomId,
            role: 'viewer'
        });

        // Request an offer from the camera
        setTimeout(() => {
            this.socket.emit('request-offer');
        }, 1000);
    }

    async handleOffer(offer, senderId) {
        try {
            this.updateStatus('🤝 Establishing connection...', 'disconnected');

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Handle incoming stream
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote stream');
                this.remoteVideo.srcObject = event.streams[0];
                this.isConnected = true;
                this.isConnecting = false;
                this.renderCameraList(); // Update visual state
                this.updateStatus(`📺 Viewing: ${this.currentCamera.name}`, 'connected');
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        target: senderId,
                        candidate: event.candidate
                    });
                }
            };

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);
                
                switch (this.peerConnection.connectionState) {
                    case 'connected':
                        this.isConnected = true;
                        this.isConnecting = false;
                        this.updateStatus(`📺 Viewing: ${this.currentCamera.name}`, 'connected');
                        break;
                    case 'disconnected':
                    case 'failed':
                    case 'closed':
                        this.isConnected = false;
                        this.isConnecting = false;
                        this.remoteVideo.srcObject = null;
                        this.updateStatus('📴 Connection lost', 'disconnected');
                        break;
                    case 'connecting':
                        this.updateStatus('🔄 Connecting...', 'disconnected');
                        break;
                }
                this.renderCameraList();
            };

            // Set remote description and create answer
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Send answer back to camera
            this.socket.emit('answer', {
                target: senderId,
                answer: answer
            });

            console.log('Answer sent to camera');

        } catch (error) {
            console.error('Error handling offer:', error);
            this.updateStatus('❌ Connection failed: ' + error.message, 'disconnected');
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.remoteVideo.srcObject = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.currentCamera = null;
        
        this.viewingInfo.style.display = 'none';
        this.videoPlaceholder.style.display = 'flex';
        
        this.renderCameraList();
        this.updateStatus('📱 Click any camera to start viewing', 'connected');
    }

    updateStatus(message, type) {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }
}

// Initialize the viewer when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CCTVViewer();
});