class CCTVViewer {
    constructor() {
        this.authToken = null;
        this.socket = null;
        this.remoteVideo = document.getElementById('remoteVideo');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.refreshBtn = document.getElementById('refreshCameras');
        this.status = document.getElementById('status');
        this.cameraList = document.getElementById('cameraList');
        this.viewingInfo = document.getElementById('viewingInfo');
        this.currentCameraName = document.getElementById('currentCameraName');
        this.videoPlaceholder = document.getElementById('videoPlaceholder');
        this.remoteVideoSelect = document.getElementById('remoteVideoSelect');
        this.remoteAudioSelect = document.getElementById('remoteAudioSelect');
        this.refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
        
        this.peerConnection = null;
        this.currentCamera = null;
        this.availableCameras = [];
        this.remoteDevices = { video: [], audio: [], current: {} };
        this.isConnected = false;
        this.isConnecting = false;
        
        this.initializeEventListeners();
        
        // Initialize authentication and socket connection
        this.initializeAuthentication();
    }

    async initializeAuthentication() {
        try {
            // Get authentication token from server
            const response = await fetch('/api/auth/token', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to get authentication token');
            }
            
            const data = await response.json();
            this.authToken = data.token;
            
            // Initialize socket connection with authentication
            this.socket = io({
                auth: {
                    token: this.authToken
                }
            });
            
            this.initializeSocketListeners();
            this.loadCameras();
            
            // Set up periodic token validation (every 5 minutes)
            setInterval(() => this.validateToken(), 5 * 60 * 1000);
            
        } catch (error) {
            console.error('Authentication failed:', error);
            alert('Authentication failed. Please log in again.');
            window.location.href = '/login';
        }
    }

    async validateToken() {
        try {
            const response = await fetch('/api/auth/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Token validation failed');
            }
            
            const result = await response.json();
            if (!result.valid) {
                throw new Error('Token is no longer valid');
            }
            
        } catch (error) {
            console.error('Token validation failed:', error);
            alert('Your session has expired. Please log in again.');
            window.location.href = '/login';
        }
    }

    initializeEventListeners() {
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.refreshBtn.addEventListener('click', () => this.loadCameras());
        this.refreshDevicesBtn.addEventListener('click', () => this.requestRemoteDeviceList());
        
        this.remoteVideoSelect.addEventListener('change', (e) => {
            if (e.target.value && this.isConnected) {
                this.requestDeviceSwitch('video', e.target.value);
            }
        });
        
        this.remoteAudioSelect.addEventListener('change', (e) => {
            if (e.target.value && this.isConnected) {
                this.requestDeviceSwitch('audio', e.target.value);
            }
        });
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

        this.socket.on('connect_error', (error) => {
            console.error('Connection failed:', error.message);
            if (error.message.includes('Authentication')) {
                alert('Authentication failed. Please log in again.');
                window.location.href = '/login';
            } else {
                this.updateStatus('❌ Connection failed', 'disconnected');
            }
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            if (error.message && error.message.includes('Authentication')) {
                alert('Authentication failed. Please log in again.');
                window.location.href = '/login';
            }
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

        this.socket.on('device-list', (data) => {
            console.log('Received device list from camera:', data.devices);
            this.updateRemoteDeviceList(data.devices);
        });

        this.socket.on('device-switched', (data) => {
            console.log('Device switch result:', data);
            if (data.success) {
                this.updateStatus(`✅ Switched ${data.deviceType} successfully`, 'connected');
            } else {
                this.updateStatus(`❌ Failed to switch ${data.deviceType}: ${data.error}`, 'connected');
            }
        });
    }

    async loadCameras() {
        try {
            const response = await fetch('/api/cameras', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    alert('Authentication failed. Please log in again.');
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
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
        this.hideVideo(); // Hide video until stream is received
        
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
            // Also request the device list
            this.requestRemoteDeviceList();
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
                this.showVideo();
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
                        this.hideVideo();
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

        this.hideVideo();
        this.isConnected = false;
        this.isConnecting = false;
        this.currentCamera = null;
        
        this.viewingInfo.style.display = 'none';
        this.videoPlaceholder.style.display = 'flex';
        
        this.renderCameraList();
        this.updateStatus('📱 Click any camera to start viewing', 'connected');
    }

    requestRemoteDeviceList() {
        if (this.isConnected && this.currentCamera) {
            this.socket.emit('request-device-list', {
                roomId: this.currentCamera.roomId
            });
        }
    }

    updateRemoteDeviceList(devices) {
        this.remoteDevices = devices;
        
        // Update video device selector
        this.remoteVideoSelect.innerHTML = '<option value="">Select Camera...</option>';
        devices.video.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label;
            if (device.deviceId === devices.current.video) {
                option.selected = true;
            }
            this.remoteVideoSelect.appendChild(option);
        });
        
        // Update audio device selector
        this.remoteAudioSelect.innerHTML = '<option value="">Select Microphone...</option>';
        devices.audio.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label;
            if (device.deviceId === devices.current.audio) {
                option.selected = true;
            }
            this.remoteAudioSelect.appendChild(option);
        });
    }

    requestDeviceSwitch(deviceType, deviceId) {
        if (this.isConnected && this.currentCamera) {
            console.log(`Requesting switch of ${deviceType} to:`, deviceId);
            this.socket.emit('switch-device-request', {
                roomId: this.currentCamera.roomId,
                deviceType: deviceType,
                deviceId: deviceId
            });
            this.updateStatus(`🔄 Switching ${deviceType}...`, 'connected');
        }
    }

    showVideo() {
        this.remoteVideo.style.display = 'block';
        this.videoPlaceholder.style.display = 'none';
    }

    hideVideo() {
        this.remoteVideo.srcObject = null;
        this.remoteVideo.style.display = 'none';
        this.videoPlaceholder.style.display = 'flex';
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