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
        
        // Enhanced background streaming support
        this.isBackgroundMode = false;
        this.backgroundKeepAlive = null;
        this.lastActivityTime = Date.now();
        this.wakeLock = null;
        this.backgroundCanvas = null;
        this.backgroundInterval = null;
        this.streamMonitorInterval = null;
        
        // Security alert system
        this.alertsEnabled = false;
        this.motionDetectionEnabled = false;
        this.audioDetectionEnabled = false;
        this.motionSensitivity = 0.3; // 0.1 = very sensitive, 0.5 = less sensitive
        this.audioSensitivity = 0.7; // Volume threshold for suspicious sounds
        this.alertCooldown = 10000; // 10 seconds between alerts of same type
        this.lastMotionAlert = 0;
        this.lastAudioAlert = 0;
        
        // Motion detection canvas and context
        this.motionCanvas = null;
        this.motionContext = null;
        this.previousFrameData = null;
        this.motionDetectionInterval = null;
        
        // Audio analysis
        this.audioContext = null;
        this.audioAnalyser = null;
        this.audioDataArray = null;
        this.audioDetectionInterval = null;

        // Speak mode (receiving audio from viewers)
        this.speakPeerConnections = new Map(); // Store connections for receiving audio from viewers
        this.speakAudioElement = null; // Audio element to play received speech
        
        this.initializeEventListeners();
        this.initializeDefaults();
        this.detectBrowserAndDevice();
        this.loadAvailableDevices();
        this.hideVideo(); // Initially hide video until camera starts
        
        // Listen for device changes
        this.setupDeviceChangeListeners();
        
        // Setup background streaming support
        this.setupBackgroundStreaming();
        
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

        // Security alert event listeners
        this.initializeAlertEventListeners();
    }

    initializeAlertEventListeners() {
        const enableAlertsCheckbox = document.getElementById('enableAlerts');
        const alertOptions = document.getElementById('alertOptions');
        const enableMotionCheckbox = document.getElementById('enableMotionDetection');
        const enableAudioCheckbox = document.getElementById('enableAudioDetection');
        const motionSensitivitySlider = document.getElementById('motionSensitivity');
        const audioSensitivitySlider = document.getElementById('audioSensitivity');
        const alertCooldownInput = document.getElementById('alertCooldown');
        const testMotionBtn = document.getElementById('testMotionBtn');
        const testAudioBtn = document.getElementById('testAudioBtn');

        // Show/hide alert options
        if (enableAlertsCheckbox) {
            enableAlertsCheckbox.addEventListener('change', (e) => {
                console.log('🎯 Main security alerts checkbox changed by USER:', e.target.checked);
                
                if (alertOptions) {
                    alertOptions.style.display = e.target.checked ? 'block' : 'none';
                }
                
                if (e.target.checked && this.localStream) {
                    this.enableSecurityAlerts();
                } else {
                    this.disableSecurityAlerts();
                }
            });
        }

        // Motion detection toggle
        if (enableMotionCheckbox) {
            enableMotionCheckbox.addEventListener('change', (e) => {
                this.motionDetectionEnabled = e.target.checked;
                this.updateAlertSettings({
                    motionEnabled: this.motionDetectionEnabled
                });
            });
        }

        // Audio detection toggle
        if (enableAudioCheckbox) {
            enableAudioCheckbox.addEventListener('change', (e) => {
                this.audioDetectionEnabled = e.target.checked;
                this.updateAlertSettings({
                    audioEnabled: this.audioDetectionEnabled
                });
            });
        }

        // Motion sensitivity slider
        if (motionSensitivitySlider) {
            motionSensitivitySlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('motionSensitivityValue').textContent = value;
                this.updateAlertSettings({
                    motionSensitivity: value
                });
            });
        }

        // Audio sensitivity slider
        if (audioSensitivitySlider) {
            audioSensitivitySlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('audioSensitivityValue').textContent = value;
                this.updateAlertSettings({
                    audioSensitivity: value
                });
            });
        }

        // Alert cooldown input
        if (alertCooldownInput) {
            alertCooldownInput.addEventListener('change', (e) => {
                const seconds = parseInt(e.target.value);
                this.updateAlertSettings({
                    cooldownSeconds: seconds
                });
            });
        }

        // Test buttons
        if (testMotionBtn) {
            testMotionBtn.addEventListener('click', () => {
                this.testMotionDetection();
            });
        }

        if (testAudioBtn) {
            testAudioBtn.addEventListener('click', () => {
                this.testAudioDetection();
            });
        }
    }

    testMotionDetection() {
        if (!this.alertsEnabled) {
            alert('Please enable security alerts first');
            return;
        }

        console.log('🧪 Testing motion detection...');
        this.onMotionDetected(0.5); // Simulate 50% motion intensity
    }

    testAudioDetection() {
        if (!this.alertsEnabled) {
            alert('Please enable security alerts first');
            return;
        }

        console.log('🧪 Testing audio detection...');
        this.onSuspiciousAudioDetected(0.8); // Simulate 80% volume level
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

        this.socket.on('alert-settings-update', (settings) => {
            console.log('Received alert settings update from viewer:', settings);
            this.updateAlertSettings(settings);
        });

        this.socket.on('send-current-alert-settings', (data) => {
            console.log('Viewer requesting current alert settings');
            this.sendCurrentAlertSettings(data.requesterId);
        });

        // ==================== SPEAK MODE HANDLERS ====================

        this.socket.on('speak-offer', (data) => {
            console.log('🎤 Received speak offer from viewer');
            this.handleSpeakOffer(data.offer, data.viewerId);
        });

        this.socket.on('speak-ice-candidate', (data) => {
            console.log('🎤 Received speak ICE candidate from viewer');
            this.handleSpeakIceCandidate(data.candidate, data.viewerId);
        });

        this.socket.on('speak-stop', (data) => {
            console.log('🎤 Viewer stopped speaking');
            this.stopReceivingSpeech(data.viewerId);
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
            
            // Show security alert configuration
            const securityAlertsConfig = document.getElementById('securityAlertsConfig');
            if (securityAlertsConfig) {
                securityAlertsConfig.style.display = 'block';
            }

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
        // Clean up security alerts
        this.disableSecurityAlerts();
        
        // Clean up background streaming resources
        this.stopBackgroundKeepAlive();
        this.disableBackgroundMode();
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.hideVideo();
        
        // Close all peer connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();

        // Clean up speak mode connections
        this.cleanupSpeakMode();

        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.cameraNameInput.disabled = false;
        this.deviceInfoInput.disabled = false;
        this.updateStatus('📴 Camera stopped', 'disconnected');
        
        // Hide security alert configuration
        const securityAlertsConfig = document.getElementById('securityAlertsConfig');
        if (securityAlertsConfig) {
            securityAlertsConfig.style.display = 'none';
        }
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

    setupBackgroundStreaming() {
        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Listen for page focus/blur events (additional fallback)
        window.addEventListener('focus', () => {
            this.handlePageFocus();
        });
        
        window.addEventListener('blur', () => {
            this.handlePageBlur();
        });
        
        // Listen for beforeunload to try to keep streaming
        window.addEventListener('beforeunload', (event) => {
            if (this.localStream && this.peerConnections.size > 0) {
                // Try to prevent page unload when streaming
                event.preventDefault();
                event.returnValue = 'Camera is currently streaming. Are you sure you want to leave?';
                return event.returnValue;
            }
        });
        
        // Mobile-specific events
        if (this.deviceInfo && this.deviceInfo.isMobile) {
            // Listen for app state changes on mobile
            document.addEventListener('resume', () => {
                console.log('App resumed, checking camera stream...');
                this.handleAppResume();
            });
            
            document.addEventListener('pause', () => {
                console.log('App paused, enabling background mode...');
                this.handleAppPause();
            });
        }
        
        console.log('Background streaming support initialized');
    }

    handleVisibilityChange() {
        if (document.hidden) {
            console.log('Page hidden, enabling background streaming mode...');
            this.enableBackgroundMode();
        } else {
            console.log('Page visible, disabling background mode...');
            this.disableBackgroundMode();
        }
    }

    handlePageFocus() {
        console.log('Page focused');
        this.lastActivityTime = Date.now();
        this.disableBackgroundMode();
    }

    handlePageBlur() {
        console.log('Page blurred');
        if (this.localStream) {
            this.enableBackgroundMode();
        }
    }

    handleAppResume() {
        console.log('Mobile app resumed');
        this.lastActivityTime = Date.now();
        this.disableBackgroundMode();
        
        // Check if camera stream is still active
        if (this.localStream) {
            this.verifyStreamHealth();
        }
    }

    handleAppPause() {
        console.log('Mobile app paused');
        if (this.localStream) {
            this.enableBackgroundMode();
        }
    }

    enableBackgroundMode() {
        if (this.isBackgroundMode || !this.localStream) {
            return;
        }
        
        console.log('🔄 Enabling enhanced background streaming mode...');
        this.isBackgroundMode = true;
        
        // Update status to show background mode
        this.updateStatus('📱 Running in background - Camera active', 'connected');
        
        // Set up keep-alive mechanism
        this.startBackgroundKeepAlive();
        
        // Enhanced mobile browser support
        if (this.deviceInfo && this.deviceInfo.isMobile) {
            this.enableAggressiveBackgroundMode();
            // Create video keepalive system specifically for mobile
            this.createVideoKeepaliveCanvas();
        }
        
        // Reduce video element updates to save resources
        if (this.localVideo) {
            this.localVideo.style.opacity = '0.3';
            // Keep video playing to prevent stream suspension
            this.localVideo.muted = true;
            this.localVideo.play().catch(e => console.log('Video play failed:', e));
        }
        
        // Start stream monitoring
        this.startStreamMonitoring();
        
        // Notify viewers about background mode
        if (this.socket) {
            this.socket.emit('camera-background-mode', {
                roomId: this.roomId,
                backgroundMode: true
            });
        }
    }

    disableBackgroundMode() {
        if (!this.isBackgroundMode) {
            return;
        }
        
        console.log('🔄 Disabling background mode, returning to normal operation...');
        this.isBackgroundMode = false;
        
        // Stop keep-alive
        this.stopBackgroundKeepAlive();
        
        // Clean up aggressive background mode resources
        this.cleanupBackgroundMode();
        
        // Restore video element
        if (this.localVideo) {
            this.localVideo.style.opacity = '1';
            this.localVideo.muted = false;
        }
        
        // Update status
        if (this.localStream) {
            this.updateStatus('📺 Camera active - Normal mode', 'connected');
        }
        
        // Notify viewers about normal mode
        if (this.socket) {
            this.socket.emit('camera-background-mode', {
                roomId: this.roomId,
                backgroundMode: false
            });
        }
    }

    cleanupBackgroundMode() {
        // Release wake lock
        if (this.wakeLock) {
            this.wakeLock.release().catch(e => console.log('Wake lock release failed:', e));
            this.wakeLock = null;
        }
        
        // Clean up background canvas
        if (this.backgroundCanvas) {
            if (this.backgroundCanvas.parentNode) {
                this.backgroundCanvas.parentNode.removeChild(this.backgroundCanvas);
            }
            this.backgroundCanvas = null;
        }
        
        // Clean up video keepalive elements
        if (this.keepaliveVideo) {
            if (this.keepaliveVideo.parentNode) {
                this.keepaliveVideo.parentNode.removeChild(this.keepaliveVideo);
            }
            this.keepaliveVideo = null;
        }
        
        if (this.videoCanvas) {
            if (this.videoCanvas.parentNode) {
                this.videoCanvas.parentNode.removeChild(this.videoCanvas);
            }
            this.videoCanvas = null;
        }
        
        // Clear background intervals
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
        
        if (this.streamTouchInterval) {
            clearInterval(this.streamTouchInterval);
            this.streamTouchInterval = null;
        }
        
        if (this.streamMonitorInterval) {
            clearInterval(this.streamMonitorInterval);
            this.streamMonitorInterval = null;
        }
        
        if (this.connectionMaintenanceInterval) {
            clearInterval(this.connectionMaintenanceInterval);
            this.connectionMaintenanceInterval = null;
        }
        
        if (this.suspensionIntervals) {
            this.suspensionIntervals.forEach(interval => clearInterval(interval));
            this.suspensionIntervals = null;
        }
        
        console.log('📱 Background mode cleanup completed');
    }

    startBackgroundKeepAlive() {
        if (this.backgroundKeepAlive) {
            return; // Already running
        }
        
        console.log('Starting background keep-alive mechanism...');
        
        // Send periodic signals to keep the connection alive
        this.backgroundKeepAlive = setInterval(() => {
            if (this.socket && this.localStream) {
                // Send keep-alive signal
                this.socket.emit('camera-keep-alive', {
                    roomId: this.roomId,
                    timestamp: Date.now(),
                    streamActive: true,
                    backgroundMode: this.isBackgroundMode
                });
                
                // Verify stream health
                this.verifyStreamHealth();
                
                console.log('📡 Background keep-alive signal sent');
            }
        }, 5000); // Every 5 seconds
        
        // Also try to prevent mobile browser from sleeping
        if (this.deviceInfo && this.deviceInfo.isMobile) {
            this.preventMobileSleep();
        }
    }

    stopBackgroundKeepAlive() {
        if (this.backgroundKeepAlive) {
            console.log('Stopping background keep-alive mechanism...');
            clearInterval(this.backgroundKeepAlive);
            this.backgroundKeepAlive = null;
        }
    }

    verifyStreamHealth() {
        if (!this.localStream) {
            return;
        }
        
        const videoTracks = this.localStream.getVideoTracks();
        const audioTracks = this.localStream.getAudioTracks();
        
        let streamHealthy = true;
        
        // Check video tracks
        videoTracks.forEach(track => {
            if (track.readyState !== 'live') {
                console.warn('Video track not live:', track.readyState);
                streamHealthy = false;
            }
        });
        
        // Check audio tracks
        audioTracks.forEach(track => {
            if (track.readyState !== 'live') {
                console.warn('Audio track not live:', track.readyState);
                streamHealthy = false;
            }
        });
        
        if (!streamHealthy) {
            console.error('Stream health check failed, attempting recovery...');
            this.attemptStreamRecovery();
        } else {
            console.log('✅ Stream health check passed');
        }
    }

    async attemptStreamRecovery() {
        if (!this.currentDevices.video) {
            console.error('Cannot recover stream: no current video device');
            return;
        }
        
        try {
            console.log('🔄 Attempting stream recovery in background...');
            
            // Try to restart the stream with current devices
            const constraints = {
                video: {
                    deviceId: { ideal: this.currentDevices.video },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: this.currentDevices.audio ? {
                    deviceId: { ideal: this.currentDevices.audio }
                } : true
            };
            
            const newStream = await this.getUserMediaSafely(constraints);
            
            // Replace the stream
            const oldStream = this.localStream;
            this.localStream = newStream;
            
            // Update video element
            this.localVideo.srcObject = newStream;
            
            // Update peer connections
            this.peerConnections.forEach(async (peerConnection, viewerId) => {
                const senders = peerConnection.getSenders();
                const newTracks = newStream.getTracks();
                
                for (const newTrack of newTracks) {
                    const sender = senders.find(s => s.track && s.track.kind === newTrack.kind);
                    if (sender) {
                        await sender.replaceTrack(newTrack);
                    }
                }
            });
            
            // Stop old stream
            if (oldStream) {
                oldStream.getTracks().forEach(track => track.stop());
            }
            
            console.log('✅ Stream recovery successful');
            this.updateStatus('🔄 Stream recovered in background', 'connected');
            
        } catch (error) {
            console.error('❌ Stream recovery failed:', error);
            this.updateStatus('❌ Background stream recovery failed', 'error');
        }
    }

    // ==================== SECURITY ALERT SYSTEM ====================

    enableSecurityAlerts() {
        if (!this.localStream) {
            console.warn('Cannot enable alerts: no active stream');
            return;
        }
        
        console.log('🚨 Enabling security alert system...');
        this.alertsEnabled = true;
        
        if (this.motionDetectionEnabled) {
            this.startMotionDetection();
        }
        
        if (this.audioDetectionEnabled) {
            this.startAudioDetection();
        }
        
        // Notify viewers that alerts are enabled
        this.socket.emit('security-alerts-status', {
            enabled: true,
            motionEnabled: this.motionDetectionEnabled,
            audioEnabled: this.audioDetectionEnabled
        });
        
        this.updateStatus('🚨 Security alerts enabled', 'connected');
    }

    disableSecurityAlerts() {
        console.log('📴 Disabling security alert system...');
        this.alertsEnabled = false;
        this.motionDetectionEnabled = false;
        this.audioDetectionEnabled = false;
        
        this.stopMotionDetection();
        this.stopAudioDetection();
        
        console.log('✅ Security alert system fully disabled - no more alerts will be sent');
        
        // Notify viewers that alerts are disabled
        this.socket.emit('security-alerts-status', {
            enabled: false,
            motionEnabled: false,
            audioEnabled: false
        });
        
        this.updateStatus('📴 Security alerts disabled', 'connected');
    }

    startMotionDetection() {
        if (!this.localVideo || !this.alertsEnabled) {
            return;
        }
        
        try {
            // Create motion detection canvas
            this.motionCanvas = document.createElement('canvas');
            this.motionCanvas.width = 160; // Smaller for performance
            this.motionCanvas.height = 120;
            this.motionContext = this.motionCanvas.getContext('2d');
            
            console.log('👁️ Starting motion detection...');
            
            // Analyze frames more frequently for better sensitivity (every 250ms)
            this.motionDetectionInterval = setInterval(() => {
                this.analyzeMotion();
            }, 250);
            
        } catch (error) {
            console.error('Motion detection setup failed:', error);
        }
    }

    stopMotionDetection() {
        if (this.motionDetectionInterval) {
            clearInterval(this.motionDetectionInterval);
            this.motionDetectionInterval = null;
        }
        
        if (this.motionCanvas) {
            this.motionCanvas = null;
            this.motionContext = null;
            this.previousFrameData = null;
        }
        
        console.log('👁️ Motion detection stopped');
    }

    analyzeMotion() {
        // Safety check: don't analyze if alerts are disabled
        if (!this.alertsEnabled || !this.motionDetectionEnabled) {
            return;
        }
        
        if (!this.localVideo || this.localVideo.readyState !== 4) {
            return; // Video not ready
        }
        
        try {
            // Draw current video frame to canvas
            this.motionContext.drawImage(this.localVideo, 0, 0, 160, 120);
            const currentFrameData = this.motionContext.getImageData(0, 0, 160, 120);
            
            if (this.previousFrameData) {
                // Calculate difference between frames
                const diff = this.calculateFrameDifference(currentFrameData.data, this.previousFrameData.data);
                
                // Check if motion exceeds threshold
                // Convert sensitivity to proper threshold: 0.1 = very sensitive (low threshold), 0.8 = less sensitive (high threshold)
                // With improved algorithm, use sensitivity more directly but scaled appropriately
                const threshold = this.motionSensitivity * 0.002; // Scale to 0.0002-0.0016 range for new algorithm
                
                console.log('🔍 Motion analysis:', {
                    diff: diff.toFixed(6),
                    sensitivity: this.motionSensitivity,
                    threshold: threshold.toFixed(6),
                    triggered: diff > threshold
                });
                
                if (diff > threshold) {
                    this.onMotionDetected(diff);
                }
            }
            
            // Store current frame for next comparison
            this.previousFrameData = currentFrameData;
            
        } catch (error) {
            console.error('Motion analysis failed:', error);
        }
    }

    calculateFrameDifference(current, previous) {
        let totalDiff = 0;
        let significantPixels = 0;
        const pixels = current.length / 4; // RGBA = 4 values per pixel
        const changeThreshold = 15; // Minimum change per pixel to count as significant
        
        for (let i = 0; i < pixels; i++) {
            const index = i * 4;
            // Calculate grayscale difference for performance
            const currentGray = (current[index] + current[index + 1] + current[index + 2]) / 3;
            const previousGray = (previous[index] + previous[index + 1] + previous[index + 2]) / 3;
            
            const pixelDiff = Math.abs(currentGray - previousGray);
            
            // Only count pixels with significant changes to reduce noise
            if (pixelDiff > changeThreshold) {
                totalDiff += pixelDiff;
                significantPixels++;
            }
        }
        
        // Return percentage of significantly changed pixels
        const changeRatio = significantPixels / pixels;
        const avgIntensity = significantPixels > 0 ? (totalDiff / significantPixels) / 255 : 0;
        
        // Combine change ratio and intensity for better detection
        return changeRatio * avgIntensity;
    }

    onMotionDetected(intensity) {
        // Safety check: don't send alerts if system is disabled
        if (!this.alertsEnabled || !this.motionDetectionEnabled) {
            console.log('🚫 Motion detected but alerts are disabled - skipping alert');
            return;
        }
        
        const now = Date.now();
        
        // Check cooldown period
        if (now - this.lastMotionAlert < this.alertCooldown) {
            return; // Still in cooldown
        }
        
        this.lastMotionAlert = now;
        
        console.warn(`🚨 Motion detected! Intensity: ${intensity.toFixed(3)}`);
        
        // Send alert to all viewers
        this.socket.emit('security-alert', {
            type: 'motion',
            timestamp: now,
            intensity: intensity,
            message: `Motion detected - Intensity: ${Math.round(intensity * 100)}%`,
            cameraName: this.cameraNameInput.value || 'Unknown Camera'
        });
        
        // Show local notification
        this.updateStatus(`🚨 Motion Alert - Intensity: ${Math.round(intensity * 100)}%`, 'warning');
        setTimeout(() => {
            if (this.status.textContent.includes('Motion Alert')) {
                this.updateStatus('📹 Camera streaming - Security alerts active', 'connected');
            }
        }, 3000);
    }

    startAudioDetection() {
        if (!this.localStream || !this.alertsEnabled) {
            return;
        }
        
        try {
            // Create audio context and analyser
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
            
            const bufferLength = this.audioAnalyser.frequencyBinCount;
            this.audioDataArray = new Uint8Array(bufferLength);
            
            // Get audio track from stream
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('No audio track available for audio detection');
                return;
            }
            
            // Create audio source from stream
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            source.connect(this.audioAnalyser);
            
            console.log('🔊 Starting audio detection...');
            
            // Analyze audio every 200ms
            this.audioDetectionInterval = setInterval(() => {
                this.analyzeAudio();
            }, 200);
            
        } catch (error) {
            console.error('Audio detection setup failed:', error);
        }
    }

    stopAudioDetection() {
        if (this.audioDetectionInterval) {
            clearInterval(this.audioDetectionInterval);
            this.audioDetectionInterval = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.audioAnalyser = null;
        this.audioDataArray = null;
        
        console.log('🔊 Audio detection stopped');
    }

    analyzeAudio() {
        // Safety check: don't analyze if alerts are disabled
        if (!this.alertsEnabled || !this.audioDetectionEnabled) {
            return;
        }
        
        if (!this.audioAnalyser) {
            return;
        }
        
        try {
            // Get frequency data
            this.audioAnalyser.getByteFrequencyData(this.audioDataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < this.audioDataArray.length; i++) {
                sum += this.audioDataArray[i];
            }
            const averageVolume = sum / this.audioDataArray.length / 255; // Normalize to 0-1
            
            // Check for volume spikes (suspicious sounds)
            if (averageVolume > this.audioSensitivity) {
                this.onSuspiciousAudioDetected(averageVolume);
            }
            
        } catch (error) {
            console.error('Audio analysis failed:', error);
        }
    }

    onSuspiciousAudioDetected(volume) {
        // Safety check: don't send alerts if system is disabled
        if (!this.alertsEnabled || !this.audioDetectionEnabled) {
            console.log('🚫 Suspicious audio detected but alerts are disabled - skipping alert');
            return;
        }
        
        const now = Date.now();
        
        // Check cooldown period
        if (now - this.lastAudioAlert < this.alertCooldown) {
            return; // Still in cooldown
        }
        
        this.lastAudioAlert = now;
        
        console.warn(`🔊 Suspicious audio detected! Volume: ${volume.toFixed(3)}`);
        
        // Send alert to all viewers
        this.socket.emit('security-alert', {
            type: 'audio',
            timestamp: now,
            volume: volume,
            message: `Suspicious sound detected - Volume: ${Math.round(volume * 100)}%`,
            cameraName: this.cameraNameInput.value || 'Unknown Camera'
        });
        
        // Show local notification
        this.updateStatus(`🔊 Audio Alert - Volume: ${Math.round(volume * 100)}%`, 'warning');
        setTimeout(() => {
            if (this.status.textContent.includes('Audio Alert')) {
                this.updateStatus('📹 Camera streaming - Security alerts active', 'connected');
            }
        }, 3000);
    }

    updateAlertSettings(settings) {
        this.motionDetectionEnabled = settings.motionEnabled ?? this.motionDetectionEnabled;
        this.audioDetectionEnabled = settings.audioEnabled ?? this.audioDetectionEnabled;
        this.motionSensitivity = settings.motionSensitivity ?? this.motionSensitivity;
        this.audioSensitivity = settings.audioSensitivity ?? this.audioSensitivity;
        this.alertCooldown = settings.cooldownSeconds ? settings.cooldownSeconds * 1000 : this.alertCooldown;
        
        // Only update alertsEnabled if the settings explicitly provide enabled/disabled states
        // This prevents auto-disabling when other settings are changed
        if (settings.hasOwnProperty('motionEnabled') || settings.hasOwnProperty('audioEnabled')) {
            const shouldEnable = this.motionDetectionEnabled || this.audioDetectionEnabled;
            const wasEnabled = this.alertsEnabled;
            this.alertsEnabled = shouldEnable;
            
            console.log('🔄 Security alerts status change:', {
                wasEnabled,
                nowEnabled: this.alertsEnabled,
                reason: 'settings update',
                settings: settings
            });
        } else {
            console.log('⚡ Preserving current alert status during settings update:', {
                alertsEnabled: this.alertsEnabled,
                receivedSettings: settings
            });
        }
        
        console.log('🔧 Alert settings updated:', {
            alertsEnabled: this.alertsEnabled,
            motion: this.motionDetectionEnabled,
            audio: this.audioDetectionEnabled,
            motionSensitivity: this.motionSensitivity,
            audioSensitivity: this.audioSensitivity,
            cooldown: this.alertCooldown / 1000 + 's'
        });
        
        // Update UI elements to reflect new settings
        this.updateAlertSettingsUI();
        
        // Show temporary notification
        this.updateStatus('🔧 Alert settings updated from viewer', 'connected');
        setTimeout(() => {
            if (this.status.textContent.includes('Alert settings updated')) {
                this.updateStatus('📹 Camera streaming - Security alerts active', 'connected');
            }
        }, 3000);
        
        // Restart detection with new settings
        if (this.alertsEnabled) {
            this.stopMotionDetection();
            this.stopAudioDetection();
            
            if (this.motionDetectionEnabled) {
                this.startMotionDetection();
            }
            
            if (this.audioDetectionEnabled) {
                this.startAudioDetection();
            }
        }
    }

    updateAlertSettingsUI() {
        // Update checkboxes
        const enableAlertsCheckbox = document.getElementById('enableAlerts');
        const enableMotionCheckbox = document.getElementById('enableMotionDetection');
        const enableAudioCheckbox = document.getElementById('enableAudioDetection');
        const motionSensitivitySlider = document.getElementById('motionSensitivity');
        const audioSensitivitySlider = document.getElementById('audioSensitivity');
        const alertCooldownInput = document.getElementById('alertCooldown');

        // Update main enable alerts checkbox - but be more conservative about disabling it
        if (enableAlertsCheckbox) {
            const shouldBeEnabled = this.motionDetectionEnabled || this.audioDetectionEnabled;
            const currentlyChecked = enableAlertsCheckbox.checked;
            
            // Only update checkbox if there's a significant change needed
            if (shouldBeEnabled !== currentlyChecked) {
                enableAlertsCheckbox.checked = shouldBeEnabled;
                console.log('🔄 Updated main enableAlerts checkbox:', currentlyChecked, '->', shouldBeEnabled);
            } else {
                console.log('⚡ Preserving main enableAlerts checkbox state:', currentlyChecked);
            }
            
            // Show/hide the alert options panel based on the actual checkbox state
            const alertOptions = document.getElementById('alertOptions');
            if (alertOptions) {
                const showPanel = enableAlertsCheckbox.checked;
                alertOptions.style.display = showPanel ? 'block' : 'none';
                console.log('🔄 Updated alertOptions panel visibility to:', showPanel ? 'visible' : 'hidden');
            }
        }

        if (enableMotionCheckbox) {
            enableMotionCheckbox.checked = this.motionDetectionEnabled;
        }

        if (enableAudioCheckbox) {
            enableAudioCheckbox.checked = this.audioDetectionEnabled;
        }

        if (motionSensitivitySlider) {
            motionSensitivitySlider.value = this.motionSensitivity;
            const motionValueSpan = document.getElementById('motionSensitivityValue');
            if (motionValueSpan) {
                motionValueSpan.textContent = this.motionSensitivity;
            }
        }

        if (audioSensitivitySlider) {
            audioSensitivitySlider.value = this.audioSensitivity;
            const audioValueSpan = document.getElementById('audioSensitivityValue');
            if (audioValueSpan) {
                audioValueSpan.textContent = this.audioSensitivity;
            }
        }

        if (alertCooldownInput) {
            alertCooldownInput.value = this.alertCooldown / 1000;
        }

        console.log('📱 Camera UI updated with new alert settings');
    }

    sendCurrentAlertSettings(requesterId) {
        const currentSettings = {
            motionEnabled: this.motionDetectionEnabled,
            audioEnabled: this.audioDetectionEnabled,
            motionSensitivity: this.motionSensitivity,
            audioSensitivity: this.audioSensitivity,
            cooldownSeconds: this.alertCooldown / 1000,
            alertsEnabled: this.alertsEnabled
        };

        // Send current settings back to requesting viewer
        this.socket.emit('send-alert-settings-to-viewer', {
            requesterId: requesterId,
            settings: currentSettings
        });

        console.log('📋 Sent current alert settings to viewer:', currentSettings);
    }

    // ==================== END SECURITY ALERT SYSTEM ====================

    enableAggressiveBackgroundMode() {
        console.log('🚀 Enabling aggressive background mode for mobile...');
        
        // Method 1: Enhanced Wake Lock
        this.requestWakeLock();
        
        // Method 2: Create background canvas to keep GPU active
        this.createBackgroundCanvas();
        
        // Method 3: Continuous stream touching
        this.startStreamTouching();
        
        // Method 4: Prevent page suspension with intervals
        this.preventPageSuspension();
        
        // Method 5: Keep WebRTC connections active
        this.maintainWebRTCConnections();
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('📱 Screen wake lock acquired');
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('📱 Screen wake lock released, attempting to reacquire...');
                    // Try to reacquire wake lock
                    setTimeout(() => this.requestWakeLock(), 1000);
                });
            }
        } catch (error) {
            console.log('Wake lock failed:', error);
            // Fallback to old method
            this.preventMobileSleep();
        }
    }

    createBackgroundCanvas() {
        try {
            // Create a canvas that continuously draws to keep GPU active
            this.backgroundCanvas = document.createElement('canvas');
            this.backgroundCanvas.width = 1;
            this.backgroundCanvas.height = 1;
            this.backgroundCanvas.style.position = 'fixed';
            this.backgroundCanvas.style.top = '-9999px';
            this.backgroundCanvas.style.opacity = '0';
            
            const ctx = this.backgroundCanvas.getContext('2d');
            document.body.appendChild(this.backgroundCanvas);
            
            // Continuously draw to keep canvas active
            let frame = 0;
            this.backgroundInterval = setInterval(() => {
                ctx.fillStyle = frame % 2 === 0 ? '#000' : '#fff';
                ctx.fillRect(0, 0, 1, 1);
                frame++;
            }, 100);
            
            // Additional video-specific canvas for stream rendering
            if (this.deviceInfo?.isMobile && this.localStream) {
                this.createVideoKeepaliveCanvas();
            }
            
            console.log('📱 Background canvas created for GPU keep-alive');
        } catch (error) {
            console.log('Background canvas creation failed:', error);
        }
    }

    createVideoKeepaliveCanvas() {
        try {
            // Create a hidden video element that continuously processes the stream
            this.keepaliveVideo = document.createElement('video');
            this.keepaliveVideo.style.position = 'fixed';
            this.keepaliveVideo.style.top = '-9999px';
            this.keepaliveVideo.style.left = '-9999px';
            this.keepaliveVideo.style.width = '1px';
            this.keepaliveVideo.style.height = '1px';
            this.keepaliveVideo.style.opacity = '0';
            this.keepaliveVideo.muted = true;
            this.keepaliveVideo.autoplay = true;
            this.keepaliveVideo.playsInline = true;
            
            // Create canvas to continuously render video frames
            this.videoCanvas = document.createElement('canvas');
            this.videoCanvas.width = 64;
            this.videoCanvas.height = 48;
            this.videoCanvas.style.position = 'fixed';
            this.videoCanvas.style.top = '-9999px';
            this.videoCanvas.style.left = '-9999px';
            this.videoCanvas.style.opacity = '0';
            
            const videoCtx = this.videoCanvas.getContext('2d');
            document.body.appendChild(this.keepaliveVideo);
            document.body.appendChild(this.videoCanvas);
            
            // Set the stream to keepalive video
            this.keepaliveVideo.srcObject = this.localStream;
            
            // Continuously render video frames to canvas
            const renderFrame = () => {
                if (this.keepaliveVideo && !this.keepaliveVideo.paused && !this.keepaliveVideo.ended) {
                    try {
                        videoCtx.drawImage(this.keepaliveVideo, 0, 0, 64, 48);
                    } catch (e) {
                        // Ignore canvas drawing errors
                    }
                }
                
                if (this.isBackgroundMode) {
                    requestAnimationFrame(renderFrame);
                }
            };
            
            this.keepaliveVideo.addEventListener('loadeddata', () => {
                console.log('📱 Video keepalive canvas started rendering');
                renderFrame();
            });
            
            console.log('📱 Video keepalive system created');
        } catch (error) {
            console.log('Video keepalive creation failed:', error);
        }
    }

    startStreamTouching() {
        // Continuously access stream properties to prevent suspension
        const touchStream = () => {
            if (this.localStream) {
                try {
                    // Touch video tracks with enhanced video continuity
                    const videoTracks = this.localStream.getVideoTracks();
                    videoTracks.forEach(track => {
                        // Access properties to keep track active
                        const settings = track.getSettings();
                        const constraints = track.getConstraints();
                        const capabilities = track.getCapabilities();
                        
                        // Enhanced video track maintenance for mobile Chrome
                        if (this.isBackgroundMode && this.deviceInfo?.isMobile) {
                            // Force video track to stay active by accessing frame data
                            try {
                                // Temporarily enable then disable track to force refresh
                                if (track.enabled) {
                                    track.enabled = false;
                                    setTimeout(() => {
                                        track.enabled = true;
                                    }, 10);
                                }
                            } catch (e) {
                                console.log('Video track refresh failed:', e);
                            }
                        }
                        
                        // Force track activity check
                        if (track.readyState !== 'live') {
                            console.warn('Video track not live, attempting recovery...');
                            this.attemptStreamRecovery();
                        }
                    });
                    
                    // Touch audio tracks
                    const audioTracks = this.localStream.getAudioTracks();
                    audioTracks.forEach(track => {
                        const settings = track.getSettings();
                        if (track.readyState !== 'live') {
                            console.warn('Audio track not live, attempting recovery...');
                            this.attemptStreamRecovery();
                        }
                    });
                } catch (error) {
                    console.log('Stream touching failed:', error);
                }
            }
        };
        
        // Touch stream every second
        this.streamTouchInterval = setInterval(touchStream, 1000);
        console.log('📱 Stream touching started');
    }

    preventPageSuspension() {
        // Create multiple intervals to prevent page suspension
        const intervals = [];
        
        // Interval 1: Keep JavaScript engine active
        intervals.push(setInterval(() => {
            const now = Date.now();
            this.lastActivityTime = now;
        }, 500));
        
        // Interval 2: Touch DOM to keep rendering engine active
        intervals.push(setInterval(() => {
            if (document.body) {
                document.body.style.transform = 'translateZ(0)';
                setTimeout(() => {
                    document.body.style.transform = '';
                }, 10);
            }
        }, 2000));
        
        // Interval 3: Keep network active with tiny requests
        intervals.push(setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('ping', { timestamp: Date.now() });
            }
        }, 3000));
        
        // Interval 4: Force video track activity (mobile-specific)
        if (this.deviceInfo?.isMobile) {
            intervals.push(setInterval(() => {
                if (this.localStream && this.isBackgroundMode) {
                    const videoTracks = this.localStream.getVideoTracks();
                    videoTracks.forEach(track => {
                        try {
                            // Force track constraints refresh
                            const currentSettings = track.getSettings();
                            track.applyConstraints({
                                width: currentSettings.width,
                                height: currentSettings.height,
                                frameRate: currentSettings.frameRate
                            }).catch(e => {
                                // Ignore constraint errors, just trying to keep track active
                            });
                        } catch (e) {
                            // Ignore errors
                        }
                    });
                }
            }, 5000));
        }
        
        this.suspensionIntervals = intervals;
        console.log('📱 Page suspension prevention started');
    }

    maintainWebRTCConnections() {
        // Continuously check and maintain peer connections
        const maintainConnections = () => {
            this.peerConnections.forEach((pc, viewerId) => {
                try {
                    // Check connection state
                    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                        console.log(`Peer connection ${viewerId} failed, attempting recovery...`);
                        // Don't immediately close, let automatic recovery handle it
                    }
                    
                    // Generate stats to keep connection active
                    pc.getStats().then(stats => {
                        // Just accessing stats helps keep connection alive
                    }).catch(e => {
                        console.log('Stats access failed:', e);
                    });
                } catch (error) {
                    console.log(`Error maintaining connection ${viewerId}:`, error);
                }
            });
        };
        
        this.connectionMaintenanceInterval = setInterval(maintainConnections, 2000);
        console.log('📱 WebRTC connection maintenance started');
    }

    startStreamMonitoring() {
        // More aggressive stream monitoring for background mode
        this.lastFrameTime = Date.now();
        this.frameCount = 0;
        
        this.streamMonitorInterval = setInterval(() => {
            this.verifyStreamHealth();
            
            // Additional checks for background mode
            if (this.isBackgroundMode && this.localStream) {
                const videoTracks = this.localStream.getVideoTracks();
                const audioTracks = this.localStream.getAudioTracks();
                
                // Check if any tracks are muted or ended
                let needsRecovery = false;
                
                videoTracks.forEach(track => {
                    if (track.readyState === 'ended' || track.muted) {
                        console.warn('Video track issue detected:', track.readyState, track.muted);
                        needsRecovery = true;
                    }
                    
                    // Check video track settings to detect freezing
                    if (this.deviceInfo?.isMobile) {
                        const settings = track.getSettings();
                        if (settings.frameRate === 0) {
                            console.warn('Video framerate dropped to 0');
                            needsRecovery = true;
                        }
                    }
                });
                
                audioTracks.forEach(track => {
                    if (track.readyState === 'ended' || track.muted) {
                        console.warn('Audio track issue detected:', track.readyState, track.muted);
                        needsRecovery = true;
                    }
                });
                
                // Monitor video frame updates using the keepalive video
                if (this.keepaliveVideo && this.deviceInfo?.isMobile) {
                    const currentTime = this.keepaliveVideo.currentTime;
                    if (this.lastVideoTime === currentTime && currentTime > 0) {
                        this.videoStallCount = (this.videoStallCount || 0) + 1;
                        if (this.videoStallCount > 3) {
                            console.warn('Video stream appears frozen (no time updates)');
                            needsRecovery = true;
                            this.videoStallCount = 0;
                        }
                    } else {
                        this.videoStallCount = 0;
                    }
                    this.lastVideoTime = currentTime;
                }
                
                if (needsRecovery) {
                    console.log('🔄 Background mode: Stream recovery needed');
                    this.attemptStreamRecovery();
                }
            }
        }, 2000); // Check every 2 seconds in background mode
        
        console.log('📱 Enhanced stream monitoring started');
    }

    preventMobileSleep() {
        // Fallback method for older browsers
        try {
            const keepAliveVideo = document.createElement('video');
            keepAliveVideo.style.position = 'fixed';
            keepAliveVideo.style.top = '-9999px';
            keepAliveVideo.style.left = '-9999px';
            keepAliveVideo.style.width = '1px';
            keepAliveVideo.style.height = '1px';
            keepAliveVideo.style.opacity = '0';
            keepAliveVideo.muted = true;
            keepAliveVideo.loop = true;
            keepAliveVideo.autoplay = true;
            
            // Create a minimal video blob to keep playing
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const stream = canvas.captureStream(1);
            keepAliveVideo.srcObject = stream;
            
            document.body.appendChild(keepAliveVideo);
            console.log('📱 Mobile sleep prevention video created');
        } catch (error) {
            console.log('Mobile sleep prevention setup failed:', error);
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
            const constraints = {};
            
            if (targetVideoDevice) {
                if (this.deviceInfo && this.deviceInfo.isMobile) {
                    // Mobile constraints (keep existing behavior)
                    constraints.video = {
                        deviceId: { ideal: targetVideoDevice },
                        width: { ideal: 640, max: 1280 },
                        height: { ideal: 480, max: 720 },
                        frameRate: { ideal: 30, max: 30 }
                    };
                } else {
                    // PC constraints for better quality
                    constraints.video = {
                        deviceId: { ideal: targetVideoDevice },
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    };
                }
            } else {
                constraints.video = true;
            }
            
            if (targetAudioDevice) {
                constraints.audio = {
                    deviceId: { ideal: targetAudioDevice },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                };
            } else {
                constraints.audio = true;
            }
            
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

    async pcProgressiveFallback(type, deviceId) {
        console.log(`PC progressive fallback for ${type} device: ${deviceId}`);
        
        // Progressive constraint attempts for PC devices only
        const constraintAttempts = [];
        
        if (type === 'video') {
            constraintAttempts.push(
                // Attempt 1: High quality
                { video: { deviceId: { exact: deviceId }, width: 1920, height: 1080 } },
                // Attempt 2: Medium quality
                { video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } },
                // Attempt 3: Low quality
                { video: { deviceId: { exact: deviceId }, width: 640, height: 480 } },
                // Attempt 4: Just deviceId
                { video: { deviceId: { exact: deviceId } } },
                // Attempt 5: Ideal instead of exact
                { video: { deviceId: { ideal: deviceId } } }
            );
        } else {
            constraintAttempts.push(
                // Attempt 1: Full audio features
                { audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
                // Attempt 2: Just deviceId exact
                { audio: { deviceId: { exact: deviceId } } },
                // Attempt 3: Ideal instead of exact
                { audio: { deviceId: { ideal: deviceId } } }
            );
        }
        
        let lastError = null;
        
        for (let i = 0; i < constraintAttempts.length; i++) {
            try {
                console.log(`PC fallback attempt ${i + 1}:`, constraintAttempts[i]);
                
                const tempStream = await navigator.mediaDevices.getUserMedia(constraintAttempts[i]);
                const newTrack = tempStream.getTracks().find(track => track.kind === (type === 'video' ? 'video' : 'audio'));
                
                if (!newTrack) {
                    throw new Error(`No ${type} track in stream`);
                }
                
                console.log(`PC fallback attempt ${i + 1} successful`);
                
                // Replace tracks in peer connections
                const replacePromises = [];
                this.peerConnections.forEach((peerConnection, viewerId) => {
                    const senders = peerConnection.getSenders();
                    const sender = senders.find(s => s.track && s.track.kind === newTrack.kind);
                    
                    if (sender) {
                        replacePromises.push(sender.replaceTrack(newTrack));
                    }
                });
                
                await Promise.all(replacePromises);
                
                // Update local stream
                const oldTracks = this.localStream.getTracks();
                const oldTrack = oldTracks.find(track => track.kind === newTrack.kind);
                
                if (oldTrack) {
                    oldTrack.stop();
                    this.localStream.removeTrack(oldTrack);
                }
                
                this.localStream.addTrack(newTrack);
                this.localVideo.srcObject = this.localStream;
                this.showVideo();
                
                // Update device tracking
                this.currentDevices[type] = deviceId;
                
                // Clean up temp stream
                tempStream.getTracks().forEach(track => {
                    if (track !== newTrack) {
                        track.stop();
                    }
                });
                
                console.log(`PC progressive fallback completed successfully on attempt ${i + 1}`);
                return; // Success
                
            } catch (error) {
                console.log(`PC fallback attempt ${i + 1} failed:`, error.message);
                lastError = error;
            }
        }
        
        throw lastError || new Error('All PC fallback attempts failed');
    }

    async pcCameraSwitchFallback(deviceId) {
        console.log(`PC camera fallback for device: ${deviceId}`);
        
        const attempts = [
            // Attempt 1: Exact deviceId with basic constraints
            {
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            },
            // Attempt 2: Exact deviceId only
            {
                video: { deviceId: { exact: deviceId } }
            },
            // Attempt 3: Ideal deviceId with constraints
            {
                video: {
                    deviceId: { ideal: deviceId },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            },
            // Attempt 4: Ideal deviceId only
            {
                video: { deviceId: { ideal: deviceId } }
            },
            // Attempt 5: Just video true (will use default camera)
            {
                video: true
            }
        ];
        
        for (let i = 0; i < attempts.length; i++) {
            try {
                console.log(`PC fallback attempt ${i + 1}:`, attempts[i]);
                const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
                
                // Verify we got the right device (if possible)
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    console.log(`PC fallback attempt ${i + 1} success. Device: ${settings.deviceId}`);
                    
                    // If this is the last attempt (default camera), warn user
                    if (i === attempts.length - 1) {
                        console.warn('Using default camera as fallback - requested device may not be available');
                    }
                }
                
                return stream;
            } catch (error) {
                console.log(`PC fallback attempt ${i + 1} failed:`, error.message);
                
                // If this is the last attempt, throw the error
                if (i === attempts.length - 1) {
                    throw new Error(`All PC camera fallback attempts failed. Last error: ${error.message}`);
                }
            }
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
                    // Use different constraints for PC vs mobile devices
                    if (this.deviceInfo && this.deviceInfo.isMobile) {
                        // Mobile-optimized constraints (keep existing behavior)
                        constraints.video = {
                            deviceId: { ideal: deviceId },
                            width: { ideal: 640, max: 1280 },
                            height: { ideal: 480, max: 720 },
                            frameRate: { ideal: 30, max: 30 }
                        };
                    } else {
                        // PC-optimized constraints for better compatibility
                        constraints.video = {
                            deviceId: { ideal: deviceId },
                            width: { ideal: 1280, max: 1920 },
                            height: { ideal: 720, max: 1080 },
                            frameRate: { ideal: 30, max: 60 }
                        };
                    }
                    // Don't request audio - we'll keep the existing audio track
                } else {
                    // Audio constraints (same for all devices)
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
                if (type === 'video' && this.deviceInfo && !this.deviceInfo.isMobile) {
                    // For PC video devices, try our fallback approach first
                    console.log('Using PC camera fallback approach');
                    tempStream = await this.pcCameraSwitchFallback(deviceId);
                } else {
                    // For mobile devices or audio, use the standard approach
                    tempStream = await this.getUserMediaSafely(constraints);
                }
                
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
                    
                    // For PC devices only, try one more progressive fallback approach
                    if (this.deviceInfo && !this.deviceInfo.isMobile) {
                        console.log('Attempting PC-specific progressive fallback...');
                        try {
                            await this.pcProgressiveFallback(type, deviceId);
                            console.log('PC progressive fallback successful');
                            this.updateStatus(`🔄 Switched ${type} device successfully (PC fallback)`, 'connected');
                            return; // Success via PC fallback
                        } catch (pcFallbackError) {
                            console.error('PC progressive fallback also failed:', pcFallbackError);
                        }
                    }
                    
                    throw new Error(`Device switch failed: ${streamError.message}. All fallback methods failed.`);
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

    // ==================== SPEAK MODE FUNCTIONALITY ====================

    async handleSpeakOffer(offer, viewerId) {
        try {
            console.log('🎤 Handling speak offer from viewer:', viewerId);

            // Create peer connection for receiving audio
            const speakPeerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.speakPeerConnections.set(viewerId, speakPeerConnection);

            // Handle incoming audio stream
            speakPeerConnection.ontrack = (event) => {
                console.log('🎤 Received audio stream from viewer');
                this.playReceivedAudio(event.streams[0], viewerId);
            };

            // Handle ICE candidates
            speakPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('speak-ice-candidate', {
                        candidate: event.candidate,
                        viewerId: viewerId
                    });
                }
            };

            // Handle connection state changes
            speakPeerConnection.onconnectionstatechange = () => {
                console.log(`🎤 Speak connection state with ${viewerId}:`, speakPeerConnection.connectionState);
                
                if (speakPeerConnection.connectionState === 'connected') {
                    this.updateStatus('🎤 Viewer is speaking', 'connected');
                } else if (speakPeerConnection.connectionState === 'disconnected' || 
                          speakPeerConnection.connectionState === 'failed') {
                    this.stopReceivingSpeech(viewerId);
                }
            };

            // Set remote description and create answer
            await speakPeerConnection.setRemoteDescription(offer);
            const answer = await speakPeerConnection.createAnswer();
            await speakPeerConnection.setLocalDescription(answer);

            // Send answer back to viewer
            this.socket.emit('speak-answer', {
                answer: answer,
                viewerId: viewerId
            });

            console.log('🎤 Speak answer sent to viewer:', viewerId);

        } catch (error) {
            console.error('Error handling speak offer:', error);
            this.socket.emit('speak-connection-failed', {
                viewerId: viewerId,
                error: error.message
            });
        }
    }

    async handleSpeakIceCandidate(candidate, viewerId) {
        try {
            const speakPeerConnection = this.speakPeerConnections.get(viewerId);
            if (speakPeerConnection) {
                await speakPeerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Error handling speak ICE candidate:', error);
        }
    }

    playReceivedAudio(stream, viewerId) {
        try {
            // Create or reuse audio element for this viewer
            let audioElement = document.getElementById(`speak-audio-${viewerId}`);
            if (!audioElement) {
                audioElement = document.createElement('audio');
                audioElement.id = `speak-audio-${viewerId}`;
                audioElement.autoplay = true;
                audioElement.controls = false;
                audioElement.style.display = 'none';
                document.body.appendChild(audioElement);
            }

            audioElement.srcObject = stream;
            audioElement.volume = 1.0; // Full volume for received speech

            // Add visual indicator
            this.showSpeechIndicator(viewerId, true);

            console.log(`🎤 Playing audio from viewer ${viewerId}`);

        } catch (error) {
            console.error('Error playing received audio:', error);
        }
    }

    stopReceivingSpeech(viewerId) {
        try {
            // Clean up peer connection
            const speakPeerConnection = this.speakPeerConnections.get(viewerId);
            if (speakPeerConnection) {
                speakPeerConnection.close();
                this.speakPeerConnections.delete(viewerId);
            }

            // Remove audio element
            const audioElement = document.getElementById(`speak-audio-${viewerId}`);
            if (audioElement) {
                audioElement.srcObject = null;
                audioElement.remove();
            }

            // Remove visual indicator
            this.showSpeechIndicator(viewerId, false);

            // Update status if no more viewers are speaking
            if (this.speakPeerConnections.size === 0) {
                this.updateStatus('📹 Camera streaming - Ready for viewers', 'connected');
            }

            console.log(`🎤 Stopped receiving speech from viewer ${viewerId}`);

        } catch (error) {
            console.error('Error stopping speech reception:', error);
        }
    }

    showSpeechIndicator(viewerId, isReceiving) {
        // Create or update speech indicator in the UI
        let indicator = document.getElementById('speech-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'speech-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 10px 15px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
                z-index: 1000;
                display: none;
                animation: pulse 1.5s infinite;
            `;
            
            // Add CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(indicator);
        }

        if (isReceiving && this.speakPeerConnections.size > 0) {
            const speakingCount = this.speakPeerConnections.size;
            indicator.innerHTML = `🎤 ${speakingCount} viewer${speakingCount > 1 ? 's' : ''} speaking`;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    // Clean up speak mode connections when camera stops
    cleanupSpeakMode() {
        this.speakPeerConnections.forEach((connection, viewerId) => {
            this.stopReceivingSpeech(viewerId);
        });
        this.speakPeerConnections.clear();
    }

    // ==================== END SPEAK MODE FUNCTIONALITY ====================
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