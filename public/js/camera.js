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
        this.detectBrowserAndDevice();
        this.loadAvailableDevices();
        this.hideVideo(); // Initially hide video until camera starts
        
        // Listen for device changes
        this.setupDeviceChangeListeners();
        
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
            
            // Get user media with selected devices using safe method
            this.localStream = await this.getUserMediaSafely(constraints);

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
            
            let errorMessage = 'Error starting camera: ';
            
            // Provide specific error messages for common issues
            if (error.name === 'NotAllowedError') {
                errorMessage = '❌ Camera access denied. Please allow camera permissions and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = '❌ No camera found. Please connect a camera and try again.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = '❌ Camera not supported on this device/browser.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = '❌ Camera is being used by another application. Please close other apps and try again.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage = '❌ Camera constraints not supported. Please try different settings.';
            } else if (error.message.includes('HTTPS')) {
                errorMessage = '❌ HTTPS required for camera access on this device.';
            } else {
                errorMessage += error.message;
            }
            
            this.updateStatus(errorMessage, 'error');
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
            // Check if getUserMedia is supported
            if (!this.checkMediaDevicesSupport()) {
                this.updateStatus('❌ Camera access not supported on this device/browser', 'error');
                this.disableCameraControls();
                return;
            }

            console.log('Loading available devices...');

            // Request permission first to ensure device labels are available
            // Use a more permissive approach for mobile devices
            let permissionStream = null;
            try {
                permissionStream = await this.getUserMediaSafely({ 
                    video: { 
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }, 
                    audio: true 
                });
                console.log('Permission stream obtained');
                
                if (permissionStream) {
                    permissionStream.getTracks().forEach(track => track.stop());
                }
            } catch (permError) {
                console.log('Could not get permission stream, trying device enumeration anyway:', permError);
            }
            
            // Wait a bit for devices to be properly enumerated on mobile
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log('Raw device list:', devices);
            
            this.availableDevices.video = devices.filter(device => device.kind === 'videoinput');
            this.availableDevices.audio = devices.filter(device => device.kind === 'audioinput');
            
            console.log('Available video devices:', this.availableDevices.video.map(d => ({
                id: d.deviceId,
                label: d.label,
                groupId: d.groupId
            })));
            console.log('Available audio devices:', this.availableDevices.audio.map(d => ({
                id: d.deviceId,
                label: d.label,
                groupId: d.groupId
            })));
            
            // Special handling for mobile devices that might have multiple cameras
            if (this.deviceInfo && this.deviceInfo.isMobile) {
                console.log('Mobile device detected, organizing cameras...');
                this.organizeMobileCameras();
            }
            
            this.populateDeviceSelectors();
            
            // Try to extract hostname from device labels
            this.extractHostnameFromDevices();
        } catch (error) {
            console.error('Error loading devices:', error);
            this.updateStatus('⚠️ Could not load camera devices - permissions may be required', 'warning');
        }
    }

    detectBrowserAndDevice() {
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isChrome = /Chrome/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);
        
        console.log(`Device info: Mobile: ${isMobile}, Chrome: ${isChrome}, Android: ${isAndroid}`);
        console.log(`Protocol: ${location.protocol}, Host: ${location.hostname}`);
        
        // Show specific warnings for mobile users
        if (isMobile && location.protocol !== 'https:' && location.hostname !== 'localhost') {
            this.updateStatus('⚠️ Mobile devices require HTTPS for camera access', 'warning');
        }
        
        this.deviceInfo = { isMobile, isChrome, isAndroid };
    }

    checkMediaDevicesSupport() {
        // Check for navigator.mediaDevices support
        if (!navigator.mediaDevices) {
            console.error('navigator.mediaDevices not supported');
            return false;
        }
        
        // Check for getUserMedia support
        if (!navigator.mediaDevices.getUserMedia) {
            console.error('navigator.mediaDevices.getUserMedia not supported');
            return false;
        }

        // Check if we're on HTTPS (required for mobile Chrome)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            console.error('HTTPS required for camera access on this device');
            
            // More specific message for mobile
            if (this.deviceInfo && this.deviceInfo.isMobile) {
                return false;
            }
        }

        return true;
    }

    async getUserMediaSafely(constraints) {
        try {
            // First check support
            if (!this.checkMediaDevicesSupport()) {
                throw new Error('Media devices not supported');
            }

            // Try modern getUserMedia
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.error('getUserMedia failed:', error);
            
            // Try legacy getUserMedia as fallback
            try {
                return await this.getLegacyUserMedia(constraints);
            } catch (legacyError) {
                console.error('Legacy getUserMedia also failed:', legacyError);
                throw new Error(`Camera access failed: ${error.message}. Please ensure you're using HTTPS and have granted camera permissions.`);
            }
        }
    }

    getLegacyUserMedia(constraints) {
        return new Promise((resolve, reject) => {
            // Legacy getUserMedia support
            const getUserMedia = navigator.getUserMedia || 
                               navigator.webkitGetUserMedia || 
                               navigator.mozGetUserMedia || 
                               navigator.msGetUserMedia;
            
            if (!getUserMedia) {
                reject(new Error('No getUserMedia support found'));
                return;
            }

            getUserMedia.call(navigator, constraints, resolve, reject);
        });
    }

    disableCameraControls() {
        this.startBtn.disabled = true;
        this.startBtn.textContent = '❌ Camera Not Available';
        
        // Show helpful error message
        this.updateStatus('📱 Camera access requires HTTPS on mobile devices. Please access via https:// or use desktop browser.', 'error');
    }

    organizeMobileCameras() {
        // Mobile devices often have front and back cameras
        // Try to organize them in a logical order (back camera first, then front)
        this.availableDevices.video.sort((a, b) => {
            const aLabel = a.label.toLowerCase();
            const bLabel = b.label.toLowerCase();
            
            // Back camera should come first
            if (aLabel.includes('back') && !bLabel.includes('back')) return -1;
            if (!aLabel.includes('back') && bLabel.includes('back')) return 1;
            
            // Then front camera
            if (aLabel.includes('front') && !bLabel.includes('front')) return -1;
            if (!aLabel.includes('front') && bLabel.includes('front')) return 1;
            
            // Otherwise keep original order
            return 0;
        });
        
        console.log('Organized mobile cameras:', this.availableDevices.video.map(d => d.label));
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
                
                // Better labeling for mobile devices
                let label = device.label || `Camera ${index + 1}`;
                
                // Add helpful indicators for mobile cameras
                if (this.deviceInfo && this.deviceInfo.isMobile) {
                    if (label.toLowerCase().includes('back')) {
                        label += ' 📷 (Rear)';
                    } else if (label.toLowerCase().includes('front')) {
                        label += ' 🤳 (Front)';
                    } else if (index === 0) {
                        label += ' (Primary)';
                    }
                }
                
                option.textContent = label;
                option.title = `Device ID: ${device.deviceId}`;
                videoSelect.appendChild(option);
            });
            
            // Select first device by default
            if (this.availableDevices.video.length > 0) {
                const firstDevice = this.availableDevices.video[0];
                videoSelect.value = firstDevice.deviceId;
                this.currentDevices.video = firstDevice.deviceId;
                console.log(`Default video device selected: ${firstDevice.label} (${firstDevice.deviceId})`);
            }
        }
        
        if (audioSelect) {
            audioSelect.innerHTML = '<option value="">Select Microphone...</option>';
            this.availableDevices.audio.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Microphone ${index + 1}`;
                option.title = `Device ID: ${device.deviceId}`;
                audioSelect.appendChild(option);
            });
            
            // Select first device by default
            if (this.availableDevices.audio.length > 0) {
                const firstDevice = this.availableDevices.audio[0];
                audioSelect.value = firstDevice.deviceId;
                this.currentDevices.audio = firstDevice.deviceId;
                console.log(`Default audio device selected: ${firstDevice.label} (${firstDevice.deviceId})`);
            }
        }
        
        // Log device selection summary
        console.log('Device selectors populated:', {
            videoDevices: this.availableDevices.video.length,
            audioDevices: this.availableDevices.audio.length,
            selectedVideo: this.currentDevices.video,
            selectedAudio: this.currentDevices.audio
        });
    }

    setupDeviceChangeListeners() {
        // Listen for device changes (when cameras are plugged/unplugged)
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                console.log('Device change detected, refreshing device list...');
                setTimeout(() => {
                    this.loadAvailableDevices();
                }, 1000); // Wait a bit for devices to settle
            });
        }
    }

    async fallbackCompleteStreamRestart(targetVideoDevice, targetAudioDevice) {
        console.log('Attempting fallback: complete stream restart');
        
        try {
            // Stop current stream completely
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }
            
            // Build new constraints with target devices
            const constraints = {
                video: targetVideoDevice ? {
                    deviceId: { ideal: targetVideoDevice },
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 30, max: 30 }
                } : true,
                audio: targetAudioDevice ? {
                    deviceId: { ideal: targetAudioDevice },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : true
            };
            
            console.log('Fallback constraints:', constraints);
            
            // Get completely new stream
            const newStream = await this.getUserMediaSafely(constraints);
            
            // Replace in all peer connections
            const replacePromises = [];
            this.peerConnections.forEach((peerConnection, viewerId) => {
                const senders = peerConnection.getSenders();
                
                newStream.getTracks().forEach(newTrack => {
                    const sender = senders.find(s => 
                        s.track && s.track.kind === newTrack.kind
                    );
                    
                    if (sender) {
                        replacePromises.push(
                            sender.replaceTrack(newTrack).catch(err => {
                                console.error(`Fallback track replacement failed for ${viewerId}:`, err);
                                throw err;
                            })
                        );
                    }
                });
            });
            
            await Promise.all(replacePromises);
            
            // Update local stream and video
            this.localStream = newStream;
            this.localVideo.srcObject = this.localStream;
            this.showVideo();
            
            // Update device tracking
            const videoTrack = newStream.getVideoTracks()[0];
            const audioTrack = newStream.getAudioTracks()[0];
            
            if (videoTrack && targetVideoDevice) {
                this.currentDevices.video = targetVideoDevice;
            }
            if (audioTrack && targetAudioDevice) {
                this.currentDevices.audio = targetAudioDevice;
            }
            
            console.log('Fallback stream restart successful');
            return true;
            
        } catch (error) {
            console.error('Fallback stream restart failed:', error);
            throw error;
        }
    }

    async switchDevice(type, deviceId) {
        if (!this.localStream) {
            throw new Error('No active camera stream to switch');
        }
        
        try {
            console.log(`Switching ${type} device to:`, deviceId);
            
            // Validate that the requested device exists
            const availableDevices = type === 'video' ? this.availableDevices.video : this.availableDevices.audio;
            const targetDevice = availableDevices.find(device => device.deviceId === deviceId);
            
            if (!targetDevice) {
                throw new Error(`${type} device with ID ${deviceId} not found`);
            }
            
            console.log(`Target device found:`, targetDevice.label);
            
            // Use a more targeted approach: only get a stream for the specific device type we're switching
            // This reduces camera access conflicts on mobile devices
            let newTrack = null;
            let tempStream = null;
            
            try {
                // Build constraints only for the device type we're switching
                const constraints = {};
                
                if (type === 'video') {
                    constraints.video = {
                        deviceId: { ideal: deviceId },
                        width: { ideal: 640, max: 1280 },
                        height: { ideal: 480, max: 720 },
                        frameRate: { ideal: 30, max: 30 }
                    };
                    // Don't request audio - we'll keep the existing audio track
                } else {
                    constraints.audio = {
                        deviceId: { ideal: deviceId },
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    };
                    // Don't request video - we'll keep the existing video track
                }
                
                console.log('Targeted device switch constraints:', constraints);
                
                // Get stream with only the track we need to switch
                tempStream = await this.getUserMediaSafely(constraints);
                
                // Get the new track of the type we're switching
                const newTracks = tempStream.getTracks();
                newTrack = newTracks.find(track => track.kind === (type === 'video' ? 'video' : 'audio'));
                
                if (!newTrack) {
                    throw new Error(`No ${type} track found in new stream`);
                }
                
                console.log(`New ${type} track obtained:`, newTrack.getSettings());
                
                // Replace the track in all peer connections first
                const replacePromises = [];
                this.peerConnections.forEach((peerConnection, viewerId) => {
                    console.log(`Replacing ${type} track for viewer: ${viewerId}`);
                    const senders = peerConnection.getSenders();
                    
                    const sender = senders.find(s => 
                        s.track && s.track.kind === newTrack.kind
                    );
                    
                    if (sender) {
                        console.log(`Replacing ${newTrack.kind} track for ${viewerId}`);
                        replacePromises.push(
                            sender.replaceTrack(newTrack).catch(err => {
                                console.error(`Failed to replace ${newTrack.kind} track for ${viewerId}:`, err);
                                throw err; // Re-throw to catch in outer try-catch
                            })
                        );
                    } else {
                        console.log(`No sender found for ${newTrack.kind} track - this is unexpected`);
                    }
                });
                
                // Wait for all track replacements to complete
                await Promise.all(replacePromises);
                
                // Find and stop the old track of the same type in the local stream
                const oldTracks = this.localStream.getTracks();
                const oldTrack = oldTracks.find(track => track.kind === newTrack.kind);
                
                if (oldTrack) {
                    console.log(`Stopping old ${oldTrack.kind} track`);
                    oldTrack.stop();
                    
                    // Remove old track from stream
                    this.localStream.removeTrack(oldTrack);
                }
                
                // Add new track to local stream
                this.localStream.addTrack(newTrack);
                
                // Update the video element source to refresh the stream
                this.localVideo.srcObject = this.localStream;
                this.showVideo(); // Ensure video is visible after switching
                
                // Update current device tracking
                this.currentDevices[type] = deviceId;
                
                // Verify the switch was successful
                const actualDeviceId = newTrack.getSettings()?.deviceId;
                console.log(`Device switch completed. Requested: ${deviceId}, Actual: ${actualDeviceId}`);
                
                // Clean up temporary stream (but not the track we extracted)
                if (tempStream) {
                    tempStream.getTracks().forEach(track => {
                        if (track !== newTrack) {
                            track.stop();
                        }
                    });
                }
                
                this.updateStatus(`🔄 Switched ${type} device successfully`, 'connected');
                
            } catch (streamError) {
                // Clean up if something went wrong
                if (tempStream) {
                    tempStream.getTracks().forEach(track => track.stop());
                }
                
                // Try fallback approach: complete stream restart
                console.log('Targeted switch failed, trying fallback approach:', streamError.message);
                
                try {
                    const fallbackVideoDevice = type === 'video' ? deviceId : this.currentDevices.video;
                    const fallbackAudioDevice = type === 'audio' ? deviceId : this.currentDevices.audio;
                    
                    await this.fallbackCompleteStreamRestart(fallbackVideoDevice, fallbackAudioDevice);
                    
                    console.log('Fallback device switch successful');
                    this.updateStatus(`🔄 Switched ${type} device successfully (fallback method)`, 'connected');
                    return; // Success via fallback
                    
                } catch (fallbackError) {
                    console.error('Both targeted and fallback switch methods failed:', fallbackError);
                    throw new Error(`Device switch failed: ${streamError.message}. Fallback also failed: ${fallbackError.message}`);
                }
            }
            
        } catch (error) {
            console.error(`Error switching ${type} device:`, error);
            
            let errorMessage = `Failed to switch ${type} device`;
            
            // Provide specific error messages
            if (error.name === 'NotAllowedError') {
                errorMessage += ': Permission denied. Please allow camera/microphone access.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += ': Device not found or disconnected.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += ': Device busy or in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += ': Device does not support required settings.';
            } else if (error.name === 'AbortError') {
                errorMessage += ': Device switch was aborted.';
            } else if (error.message) {
                errorMessage += `: ${error.message}`;
            }
            
            this.updateStatus(`❌ ${errorMessage}`, 'error');
            throw error; // Re-throw for remote switching error handling
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
        console.log(`Remote device switch requested: ${deviceType} to ${deviceId} from viewer ${viewerId}`);
        
        let originalDeviceId = null;
        let rollbackRequired = false;
        
        try {
            // Validate device type
            if (deviceType !== 'video' && deviceType !== 'audio') {
                throw new Error(`Invalid device type: ${deviceType}`);
            }
            
            // Check if we have an active stream
            if (!this.localStream) {
                throw new Error('No active camera stream available for device switching');
            }
            
            // Store original device ID for potential rollback
            originalDeviceId = this.currentDevices[deviceType];
            console.log(`Original ${deviceType} device: ${originalDeviceId}`);
            
            // Check if we're already using the requested device
            if (originalDeviceId === deviceId) {
                console.log(`Already using ${deviceType} device ${deviceId}, no switch needed`);
                
                // Send success response anyway
                this.socket.emit('device-switched', {
                    target: viewerId,
                    deviceType: deviceType,
                    deviceId: deviceId,
                    success: true,
                    deviceLabel: `Current ${deviceType} device`,
                    message: `Already using the selected ${deviceType} device`
                });
                return;
            }
            
            // Validate that the target device is available
            await this.loadAvailableDevices(); // Refresh device list to ensure accuracy
            
            const availableDevices = deviceType === 'video' ? this.availableDevices.video : this.availableDevices.audio;
            const targetDevice = availableDevices.find(device => device.deviceId === deviceId);
            
            if (!targetDevice) {
                throw new Error(`${deviceType} device with ID ${deviceId} is not available. Please refresh the device list.`);
            }
            
            console.log(`Target ${deviceType} device found: ${targetDevice.label}`);
            
            // Show switching status
            this.updateStatus(`🔄 Switching ${deviceType} device remotely to ${targetDevice.label}...`, 'warning');
            
            // Update the device selectors in the UI to reflect the change
            const selector = document.getElementById(deviceType === 'video' ? 'videoDeviceSelect' : 'audioDeviceSelect');
            if (selector) {
                selector.value = deviceId;
            }
            
            // Mark that we've started the switch (for potential rollback)
            rollbackRequired = true;
            
            // Add a small delay to prevent rapid switching conflicts
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Perform the actual device switch with retry logic
            let switchAttempts = 0;
            const maxAttempts = 3;
            let lastError = null;
            
            while (switchAttempts < maxAttempts) {
                try {
                    console.log(`Attempting device switch (attempt ${switchAttempts + 1}/${maxAttempts})`);
                    await this.switchDevice(deviceType, deviceId);
                    break; // Success, exit retry loop
                } catch (attemptError) {
                    lastError = attemptError;
                    switchAttempts++;
                    
                    if (switchAttempts < maxAttempts) {
                        console.log(`Switch attempt ${switchAttempts} failed, retrying in 500ms:`, attemptError.message);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            // Check if all attempts failed
            if (switchAttempts === maxAttempts) {
                throw lastError || new Error(`Failed to switch ${deviceType} device after ${maxAttempts} attempts`);
            }
            
            console.log(`Remote ${deviceType} device switch successful after ${switchAttempts + 1} attempt(s)`);
            
            // Send success confirmation to viewer
            this.socket.emit('device-switched', {
                target: viewerId,
                deviceType: deviceType,
                deviceId: deviceId,
                success: true,
                deviceLabel: targetDevice.label,
                message: `Successfully switched ${deviceType} to ${targetDevice.label}`
            });
            
        } catch (error) {
            console.error('Error in remote device switch:', error);
            
            // Attempt rollback if we started the switch process
            if (rollbackRequired && originalDeviceId && originalDeviceId !== deviceId) {
                console.log(`Attempting rollback to original ${deviceType} device: ${originalDeviceId}`);
                try {
                    await this.switchDevice(deviceType, originalDeviceId);
                    
                    // Update UI selector back to original
                    const selector = document.getElementById(deviceType === 'video' ? 'videoDeviceSelect' : 'audioDeviceSelect');
                    if (selector) {
                        selector.value = originalDeviceId;
                    }
                    
                    console.log(`Rollback successful for ${deviceType} device`);
                    this.updateStatus(`⚠️ ${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} switch failed, reverted to original device`, 'warning');
                } catch (rollbackError) {
                    console.error(`Rollback failed for ${deviceType} device:`, rollbackError);
                    this.updateStatus(`❌ ${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} switch failed and rollback failed`, 'error');
                }
            } else {
                // Show error on camera device
                this.updateStatus(`❌ Remote ${deviceType} switch failed: ${error.message}`, 'error');
            }
            
            // Determine error category for better user guidance
            let errorCategory = 'unknown';
            let userFriendlyMessage = error.message;
            
            if (error.name === 'NotAllowedError' || error.message.includes('Permission')) {
                errorCategory = 'permission';
                userFriendlyMessage = 'Camera/microphone access was denied. Please check permissions.';
            } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
                errorCategory = 'device_missing';
                userFriendlyMessage = 'The selected device is no longer available. Please refresh and try again.';
            } else if (error.name === 'NotReadableError' || error.message.includes('busy')) {
                errorCategory = 'device_busy';
                userFriendlyMessage = 'The device is busy or being used by another application.';
            } else if (error.name === 'OverconstrainedError') {
                errorCategory = 'constraints';
                userFriendlyMessage = 'The device does not support the required settings.';
            }
            
            // Send detailed error information to viewer
            this.socket.emit('device-switched', {
                target: viewerId,
                deviceType: deviceType,
                deviceId: deviceId,
                success: false,
                error: error.message,
                errorCategory: errorCategory,
                userFriendlyMessage: userFriendlyMessage,
                rollbackAttempted: rollbackRequired,
                message: `Failed to switch ${deviceType}: ${userFriendlyMessage}`
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
        
        // Add mobile-specific help for camera issues
        if (type === 'error' && message.includes('Camera access')) {
            this.showMobileHelp();
        }
    }

    showMobileHelp() {
        // Create a help message for mobile users
        const helpDiv = document.createElement('div');
        helpDiv.className = 'mobile-help';
        helpDiv.innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; font-size: 14px;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">📱 Mobile Camera Setup Help</h4>
                <ul style="margin: 0; padding-left: 20px; color: #856404;">
                    <li><strong>HTTPS Required:</strong> Camera access requires a secure connection (https://)</li>
                    <li><strong>Permissions:</strong> Allow camera access when prompted by your browser</li>
                    <li><strong>Chrome Mobile:</strong> Make sure you're using the latest version</li>
                    <li><strong>Alternative:</strong> Try accessing from a desktop browser if mobile doesn't work</li>
                </ul>
                <p style="margin: 10px 0 0 0; color: #856404;">
                    <small>💡 Tip: If using a local network, access via HTTPS or use 
                    <code style="background: #f8f9fa; padding: 2px 4px; border-radius: 3px;">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
                    </small>
                </p>
            </div>
        `;
        
        // Insert help after status element
        if (!document.querySelector('.mobile-help')) {
            this.status.parentNode.insertBefore(helpDiv, this.status.nextSibling);
        }
    }
}

// Initialize the camera when page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        new CCTVCamera();
    } catch (error) {
        console.error('Failed to initialize CCTV Camera:', error);
        // Show fallback error message
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = '❌ Failed to initialize camera system. Please refresh the page.';
            statusElement.className = 'status error';
        }
    }
});