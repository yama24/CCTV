class CCTVCamera {
    constructor() {
        this.authToken = null;
        this.socket = null;
        this.localVideo = document.getElementById('localVideo');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.status = document.getElementById('status');
        this.cameraNameInput = document.getElementById('cameraName');
        this.deviceInfoInput = document.getElementById('deviceInfo');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        
        this.localStream = null;
        this.peerConnections = new Map(); // Store multiple connections for multiple viewers
        this.roomId = null; // Will be generated based on camera name
        this.availableDevices = {
            video: [],
            audio: []
        };
        this.currentDevices = {
            video: null,
            audio: null
        };
        
        this.initializeEventListeners();
        this.initializeDefaults();
        this.loadAvailableDevices();
        this.hideVideo(); // Initially hide video until camera starts
        
        // Initialize authentication and socket connection
        this.initializeAuthentication();
    }

    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        
        // Device selection change listeners
        const videoSelect = document.getElementById('videoDeviceSelect');
        const audioSelect = document.getElementById('audioDeviceSelect');
        
        if (videoSelect) {
            videoSelect.addEventListener('change', (e) => {
                if (e.target.value && this.localStream) {
                    this.switchDevice('video', e.target.value);
                } else if (e.target.value) {
                    this.currentDevices.video = e.target.value;
                }
            });
        }
        
        if (audioSelect) {
            audioSelect.addEventListener('change', (e) => {
                if (e.target.value && this.localStream) {
                    this.switchDevice('audio', e.target.value);
                } else if (e.target.value) {
                    this.currentDevices.audio = e.target.value;
                }
            });
        }
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
            
            // Load user information and setup UI
            this.loadUserInfo();
            
            // Set up periodic token validation (every 5 minutes)
            setInterval(() => this.validateToken(), 5 * 60 * 1000);
            
        } catch (error) {
            console.error('Authentication failed:', error);
            alert('Authentication failed. Please log in again.');
            window.location.href = '/login';
        }
    }

    async loadUserInfo() {
        try {
            const response = await fetch('/api/auth/user', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const user = await response.json();
                this.displayUserInfo(user);
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    displayUserInfo(user) {
        const userInfoDiv = document.getElementById('user-info');
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                👤 Logged in as: <strong>${user.username}</strong> 
                <span style="background-color: ${user.role === 'admin' ? '#dc3545' : '#28a745'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">
                    ${user.role.toUpperCase()}
                </span>
            `;
        }

        // Show/hide admin navigation based on role
        const adminLinks = document.querySelectorAll('.admin-only');
        adminLinks.forEach(link => {
            link.style.display = user.role === 'admin' ? 'inline-block' : 'none';
        });
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

    initializeDefaults() {
        // Set default values
        const defaultCameraName = `Camera-${Math.random().toString(36).substr(2, 5)}`;
        this.cameraNameInput.value = defaultCameraName;
        
        // Try to get actual device name
        this.getDeviceName().then(deviceName => {
            this.deviceInfoInput.value = deviceName;
            
            // Add a hint to help users set the correct device name
            this.deviceInfoInput.placeholder = 'e.g., John\'s Laptop or Office-PC';
            this.deviceInfoInput.title = 'Enter your computer/device name for easier identification';
        });
    }

    async getDeviceName() {
        try {
            // Try to get device name from various sources
            let deviceName = 'Unknown Device';
            
            // Method 1: Try WebRTC to get local IP and potentially hostname
            try {
                const rtcConnection = new RTCPeerConnection({iceServers: []});
                rtcConnection.createDataChannel('');
                
                const offer = await rtcConnection.createOffer();
                await rtcConnection.setLocalDescription(offer);
                
                // Extract local IP from ICE candidates (may help identify device)
                const localIP = await new Promise((resolve) => {
                    rtcConnection.onicecandidate = (event) => {
                        if (event.candidate) {
                            const candidate = event.candidate.candidate;
                            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                            if (ipMatch) {
                                resolve(ipMatch[1]);
                            }
                        }
                    };
                    setTimeout(() => resolve(null), 1000); // Timeout after 1 second
                });
                
                if (localIP && localIP !== '127.0.0.1') {
                    deviceName = `Device-${localIP.split('.').slice(-2).join('-')}`;
                }
                
                rtcConnection.close();
            } catch (rtcError) {
                console.log('WebRTC method failed:', rtcError);
            }
            
            // Method 2: Parse User Agent for device information (no domain/hostname)
            const userAgent = navigator.userAgent;
            
            // Extract device info from user agent patterns
            if (userAgent.includes('Windows NT')) {
                const match = userAgent.match(/Windows NT ([\d.]+)/);
                deviceName = match ? `Windows-${match[1]}-Device` : 'Windows-Device';
            } else if (userAgent.includes('Macintosh')) {
                const match = userAgent.match(/Mac OS X ([\d_]+)/);
                deviceName = match ? `Mac-${match[1].replace(/_/g, '.')}-Device` : 'Mac-Device';
            } else if (userAgent.includes('Linux')) {
                deviceName = 'Linux-Device';
            } else if (userAgent.includes('Android')) {
                const match = userAgent.match(/Android ([\d.]+)/);
                deviceName = match ? `Android-${match[1]}-Device` : 'Android-Device';
            } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
                const match = userAgent.match(/OS ([\d_]+)/);
                deviceName = match ? `iOS-${match[1].replace(/_/g, '.')}-Device` : 'iOS-Device';
            }
            
            // Try to add more specific device info if available
            const platform = navigator.platform;
            if (platform && !deviceName.includes(platform)) {
                deviceName = `${platform}-${deviceName}`;
            }
            
            return deviceName;
            
        } catch (error) {
            console.log('Could not determine device name:', error);
            return 'Unknown-Device';
        }
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

        this.socket.on('request-device-list', (data) => {
            console.log('Viewer requesting device list');
            this.sendDeviceList(data.viewerId);
        });

        this.socket.on('switch-device-request', (data) => {
            console.log('Viewer requesting device switch:', data);
            this.handleRemoteDeviceSwitch(data.deviceType, data.deviceId, data.viewerId);
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
            
            // Build constraints with selected devices
            const constraints = {
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
            };
            
            // Use selected devices if available
            if (this.currentDevices.video) {
                constraints.video.deviceId = { exact: this.currentDevices.video };
            }
            if (this.currentDevices.audio) {
                constraints.audio.deviceId = { exact: this.currentDevices.audio };
            }
            
            // Get user media with selected devices
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            this.localVideo.srcObject = this.localStream;
            this.showVideo();
            
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

        this.hideVideo();
        
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

    async loadAvailableDevices() {
        try {
            // Request permission first to ensure device labels are available
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    stream.getTracks().forEach(track => track.stop());
                });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            this.availableDevices.video = devices.filter(device => device.kind === 'videoinput');
            this.availableDevices.audio = devices.filter(device => device.kind === 'audioinput');
            
            console.log('Available video devices:', this.availableDevices.video);
            console.log('Available audio devices:', this.availableDevices.audio);
            
            this.populateDeviceSelectors();
            
            // Try to extract hostname from device labels
            this.extractHostnameFromDevices();
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    }

    extractHostnameFromDevices() {
        // Sometimes device labels contain system information we can use
        const allDevices = [...this.availableDevices.video, ...this.availableDevices.audio];
        
        for (const device of allDevices) {
            if (device.label) {
                console.log('Device label:', device.label);
                // Look for patterns that might contain hostname
                // Some devices show up as "Camera (hostname)" or similar
            }
        }
    }

    populateDeviceSelectors() {
        const videoSelect = document.getElementById('videoDeviceSelect');
        const audioSelect = document.getElementById('audioDeviceSelect');
        
        if (videoSelect) {
            videoSelect.innerHTML = '<option value="">Select Camera...</option>';
            this.availableDevices.video.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                videoSelect.appendChild(option);
            });
            
            // Select first device by default
            if (this.availableDevices.video.length > 0) {
                videoSelect.value = this.availableDevices.video[0].deviceId;
                this.currentDevices.video = this.availableDevices.video[0].deviceId;
            }
        }
        
        if (audioSelect) {
            audioSelect.innerHTML = '<option value="">Select Microphone...</option>';
            this.availableDevices.audio.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Microphone ${index + 1}`;
                audioSelect.appendChild(option);
            });
            
            // Select first device by default
            if (this.availableDevices.audio.length > 0) {
                audioSelect.value = this.availableDevices.audio[0].deviceId;
                this.currentDevices.audio = this.availableDevices.audio[0].deviceId;
            }
        }
    }

    async switchDevice(type, deviceId) {
        if (!this.localStream) return;
        
        try {
            const constraints = {
                video: type === 'video' ? { deviceId: { exact: deviceId } } : false,
                audio: type === 'audio' ? { deviceId: { exact: deviceId } } : false
            };
            
            // If switching video, keep current audio
            if (type === 'video' && this.currentDevices.audio) {
                constraints.audio = { deviceId: { exact: this.currentDevices.audio } };
            }
            
            // If switching audio, keep current video
            if (type === 'audio' && this.currentDevices.video) {
                constraints.video = { deviceId: { exact: this.currentDevices.video } };
            }
            
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Replace tracks in existing peer connections
            const newTracks = newStream.getTracks();
            
            this.peerConnections.forEach((peerConnection) => {
                const senders = peerConnection.getSenders();
                
                newTracks.forEach(newTrack => {
                    const sender = senders.find(s => 
                        s.track && s.track.kind === newTrack.kind
                    );
                    
                    if (sender) {
                        sender.replaceTrack(newTrack);
                    }
                });
            });
            
            // Stop old tracks
            this.localStream.getTracks().forEach(track => track.stop());
            
            // Update local stream and video element
            this.localStream = newStream;
            this.localVideo.srcObject = this.localStream;
            this.showVideo(); // Ensure video is visible after switching
            this.currentDevices[type] = deviceId;
            
            this.updateStatus(`🔄 Switched ${type} device`, 'connected');
            
        } catch (error) {
            console.error(`Error switching ${type} device:`, error);
            this.updateStatus(`❌ Failed to switch ${type} device`, 'disconnected');
        }
    }

    sendDeviceList(viewerId) {
        const deviceList = {
            video: this.availableDevices.video.map(device => ({
                deviceId: device.deviceId,
                label: device.label || 'Unknown Camera'
            })),
            audio: this.availableDevices.audio.map(device => ({
                deviceId: device.deviceId,
                label: device.label || 'Unknown Microphone'
            })),
            current: this.currentDevices
        };
        
        this.socket.emit('device-list', {
            target: viewerId,
            devices: deviceList
        });
    }

    async handleRemoteDeviceSwitch(deviceType, deviceId, viewerId) {
        try {
            console.log(`Switching ${deviceType} to device:`, deviceId);
            
            // Update the device selectors in the UI
            const selector = document.getElementById(deviceType === 'video' ? 'videoDeviceSelect' : 'audioDeviceSelect');
            if (selector) {
                selector.value = deviceId;
            }
            
            // Switch the actual device
            await this.switchDevice(deviceType, deviceId);
            
            // Confirm to viewer
            this.socket.emit('device-switched', {
                target: viewerId,
                deviceType: deviceType,
                deviceId: deviceId,
                success: true
            });
            
        } catch (error) {
            console.error('Error in remote device switch:', error);
            this.socket.emit('device-switched', {
                target: viewerId,
                deviceType: deviceType,
                deviceId: deviceId,
                success: false,
                error: error.message
            });
        }
    }

    showVideo() {
        this.localVideo.style.display = 'block';
        this.cameraPlaceholder.style.display = 'none';
    }

    hideVideo() {
        this.localVideo.srcObject = null;
        this.localVideo.style.display = 'none';
        this.cameraPlaceholder.style.display = 'flex';
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