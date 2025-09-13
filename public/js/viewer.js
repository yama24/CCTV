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
        
        // Speak mode elements
        this.speakControls = document.getElementById('speakControls');
        this.startSpeakBtn = document.getElementById('startSpeakBtn');
        this.stopSpeakBtn = document.getElementById('stopSpeakBtn');
        this.speakStatus = document.getElementById('speakStatus');
        
        this.peerConnection = null;
        this.currentCamera = null;
        this.availableCameras = [];
        this.remoteDevices = { video: [], audio: [], current: {} };
        this.isConnected = false;
        this.isConnecting = false;
        this.currentAlertSettings = null;
        
        // Speak mode properties
        this.speakStream = null;
        this.isSpeaking = false;
        this.speakPeerConnection = null;
        
        this.initializeEventListeners();
        
        // Initialize authentication and socket connection
        this.initializeAuthentication();
    }

    // Helper method to ensure alert controls are visible when connected
    ensureAlertControlsVisible() {
        const alertControls = document.getElementById('alertControls');
        const securityActivation = document.getElementById('securityActivation');
        const viewingInfo = document.getElementById('viewingInfo');
        
        if (this.currentCamera) {
            // Show security activation panel
            if (securityActivation) {
                securityActivation.style.display = 'block';
                console.log('🛡️ Security activation panel made visible for camera:', this.currentCamera?.name);
            }
            
            // Show alert controls
            if (alertControls) {
                alertControls.style.display = 'block';
                console.log('🚨 Alert controls made visible for camera:', this.currentCamera?.name);
            }
            
            // Also ensure viewingInfo is visible
            if (viewingInfo) {
                viewingInfo.style.display = 'block';
                console.log('📺 ViewingInfo made visible');
            }
            return true;
        }
        return false;
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
                this.currentUser = user; // Store for later use
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

        // Update role-specific security note
        const roleNote = document.getElementById('role-specific-note');
        if (roleNote) {
            if (user.role === 'admin') {
                roleNote.innerHTML = 'As an admin, you can view all cameras in the system.';
            } else {
                roleNote.innerHTML = 'Other users cannot access your cameras.';
            }
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
        
        // Security activation controls
        const activateSecurityBtn = document.getElementById('activateSecurityBtn');
        const deactivateSecurityBtn = document.getElementById('deactivateSecurityBtn');
        const configureAlertSettingsBtn = document.getElementById('configureAlertSettingsBtn');
        
        if (activateSecurityBtn) {
            activateSecurityBtn.addEventListener('click', () => {
                console.log('🚀 Security Activation button clicked!');
                this.activateSecurityAlerts();
            });
        }
        
        if (deactivateSecurityBtn) {
            deactivateSecurityBtn.addEventListener('click', () => {
                console.log('⏹️ Security Deactivation button clicked!');
                this.deactivateSecurityAlerts();
            });
        }
        
        if (configureAlertSettingsBtn) {
            configureAlertSettingsBtn.addEventListener('click', () => {
                console.log('⚙️ Configure Alert Settings button clicked!');
                this.showAlertSettings();
            });
        }

        // Alert controls
        const clearAlertsBtn = document.getElementById('clearAlertsBtn');
        const showAlertSettingsBtn = document.getElementById('showAlertSettingsBtn');
        
        if (clearAlertsBtn) {
            clearAlertsBtn.addEventListener('click', () => this.clearAlertHistory());
        }
        
        if (showAlertSettingsBtn) {
            showAlertSettingsBtn.addEventListener('click', () => {
                console.log('⚙️ Alert Settings button clicked!');
                this.showAlertSettings();
            });
        } else {
            console.error('❌ showAlertSettingsBtn element not found!');
        }
        
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

        // Speak mode event listeners
        if (this.startSpeakBtn) {
            this.startSpeakBtn.addEventListener('click', () => this.startSpeakMode());
        }
        
        if (this.stopSpeakBtn) {
            this.stopSpeakBtn.addEventListener('click', () => this.stopSpeakMode());
        }
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
            } else if (error.message && error.message.includes('Access denied')) {
                // Handle access denied errors gracefully
                this.updateStatus(`❌ ${error.message}`, 'disconnected');
                if (this.isConnecting) {
                    this.isConnecting = false;
                    this.currentCamera = null;
                    this.viewingInfo.style.display = 'none';
                    this.renderCameraList();
                }
                // Show a user-friendly message
                setTimeout(() => {
                    this.updateStatus('🔌 Connected - Click any camera to view', 'connected');
                }, 3000);
            } else {
                this.updateStatus(`❌ Error: ${error.message || 'Unknown error'}`, 'disconnected');
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

        this.socket.on('camera-background-status', (data) => {
            console.log('Camera background status:', data);
            if (data.backgroundMode) {
                this.updateStatus(`📱 ${data.message} - Stream continues`, 'warning');
                this.showBackgroundModeIndicator(true);
            } else {
                this.updateStatus(`📺 ${data.message}`, 'connected');
                this.showBackgroundModeIndicator(false);
            }
        });

        this.socket.on('camera-keep-alive-status', (data) => {
            if (data.streamActive) {
                // Update last activity indicator
                this.updateLastActivity();
            }
        });

        // ==================== SECURITY ALERT HANDLERS ====================

        this.socket.on('security-alert-received', (alertData) => {
            console.log('🚨 Security alert received:', alertData);
            this.handleSecurityAlert(alertData);
        });

        this.socket.on('security-alerts-status-update', (statusData) => {
            console.log('🛡️ Security alerts status update:', statusData);
            this.updateSecurityAlertsStatus(statusData);
        });

        this.socket.on('alert-settings-updated', (data) => {
            console.log('✅ Alert settings successfully updated:', data);
            if (data.success && data.settings) {
                // Update local settings to stay in sync with camera
                this.currentAlertSettings = data.settings;
                this.updateStatus('✅ Alert settings updated successfully', 'connected');
                setTimeout(() => {
                    if (this.status.textContent.includes('Alert settings updated')) {
                        this.updateStatus(`📺 Viewing: ${this.currentCamera?.name || 'Camera'}`, 'connected');
                    }
                }, 3000);
            }
        });

        this.socket.on('current-alert-settings', (settings) => {
            console.log('📋 Received current alert settings:', settings);
            this.currentAlertSettings = settings;
            
            // Update activation UI based on received settings
            const isActive = settings.motionEnabled || settings.audioEnabled;
            this.updateSecurityActivationUI(isActive);
        });

        // ==================== SPEAK MODE HANDLERS ====================

        this.socket.on('speak-answer', (data) => {
            console.log('🎤 Received speak answer from camera');
            this.handleSpeakAnswer(data.answer);
        });

        this.socket.on('speak-ice-candidate', (data) => {
            console.log('🎤 Received speak ICE candidate from camera');
            this.handleSpeakIceCandidate(data.candidate);
        });

        this.socket.on('speak-connection-failed', (data) => {
            console.log('🎤 Speak connection failed:', data.error);
            this.updateSpeakStatus('Connection failed', false);
            this.cleanupSpeakMode();
        });

        // Initialize security alerts system
        this.initializeSecurityAlerts();
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
            const message = this.currentUser && this.currentUser.role === 'admin' 
                ? 'No cameras currently active in the system'
                : 'You have no active cameras';
            
            this.cameraList.innerHTML = `
                <div class="info">
                    📵 ${message}<br>
                    <small>Start a camera from the Camera page to see it here</small><br>
                    <small style="color: #666; margin-top: 5px; display: block;">
                        🔒 Remember: You can only view cameras that belong to your account
                    </small>
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
        
        // Show alert controls immediately when connecting
        this.ensureAlertControlsVisible();
        
        // Show speak controls when connected to a camera
        if (this.speakControls) {
            this.speakControls.style.display = 'block';
        }
        
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
            // Request current alert settings
            this.requestCurrentAlertSettings();
            
            // Backup check to ensure alert controls are visible
            setTimeout(() => {
                this.ensureAlertControlsVisible();
            }, 2000);
        }, 1000);
    }

    async handleOffer(offer, senderId) {
        try {
            this.updateStatus('🤝 Establishing connection...', 'disconnected');

            // Create peer connection with enhanced ICE servers for better connectivity
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    // Local STUN/TURN servers (high priority)
                    { urls: 'stun:139.162.61.4:3478' },
                    { urls: 'turn:139.162.61.4:3478' },
                    { urls: 'turn:139.162.61.4:3479' },
                    
                    // Google STUN servers (fallback)
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    
                    // Additional STUN servers for better reliability
                    { urls: 'stun:stun.services.mozilla.com' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    
                    // Public TURN servers (last resort)
                    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
                    { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
                ],
                iceCandidatePoolSize: 10
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
                
                // Ensure alert controls are visible now that we're connected
                this.ensureAlertControlsVisible();
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
                        
                        // Ensure alert controls are visible now that we're connected
                        this.ensureAlertControlsVisible();
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
        // Stop speak mode if active
        if (this.isSpeaking) {
            this.stopSpeakMode();
        }
        
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
        
        // Hide alert controls when disconnecting
        const alertControls = document.getElementById('alertControls');
        const securityActivation = document.getElementById('securityActivation');
        
        if (alertControls) {
            alertControls.style.display = 'none';
        }
        
        if (securityActivation) {
            securityActivation.style.display = 'none';
        }

        // Hide speak controls when disconnecting
        if (this.speakControls) {
            this.speakControls.style.display = 'none';
        }
        
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

    requestCurrentAlertSettings() {
        if (this.isConnected && this.currentCamera) {
            this.socket.emit('request-alert-settings', {
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

    showBackgroundModeIndicator(show) {
        let indicator = document.getElementById('backgroundModeIndicator');
        
        if (show && !indicator) {
            // Create background mode indicator
            indicator = document.createElement('div');
            indicator.id = 'backgroundModeIndicator';
            indicator.innerHTML = `
                <div style="
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #ff9500;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    animation: pulse 2s infinite;
                ">
                    📱 Camera in Background Mode
                </div>
                <style>
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.7; }
                        100% { opacity: 1; }
                    }
                </style>
            `;
            document.body.appendChild(indicator);
        } else if (!show && indicator) {
            // Remove background mode indicator
            indicator.remove();
        }
    }

    updateLastActivity() {
        let activityIndicator = document.getElementById('lastActivityIndicator');
        
        if (!activityIndicator) {
            activityIndicator = document.createElement('div');
            activityIndicator.id = 'lastActivityIndicator';
            activityIndicator.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: #28a745;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                z-index: 999;
                opacity: 0.8;
            `;
            document.body.appendChild(activityIndicator);
        }
        
        const now = new Date();
        activityIndicator.textContent = `📡 Last signal: ${now.toLocaleTimeString()}`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (activityIndicator) {
                activityIndicator.style.opacity = '0.3';
            }
        }, 3000);
    }

    // ==================== SECURITY ALERT SYSTEM ====================

    initializeSecurityAlerts() {
        // Initialize alert system properties
        this.securityAlertsEnabled = false;
        this.alertHistory = [];
        this.alertCooldowns = new Map(); // Prevent alert spam
        this.maxAlertHistory = 50;
        this.alertCooldownTime = 5000; // 5 seconds between same type alerts
        
        console.log('🛡️ Security alert system initialized');
    }

    handleSecurityAlert(alertData) {
        try {
            // Check if this alert type is in cooldown to prevent spam
            const alertKey = `${alertData.type}_${alertData.roomId}`;
            const now = Date.now();
            
            if (this.alertCooldowns.has(alertKey)) {
                const lastAlert = this.alertCooldowns.get(alertKey);
                if (now - lastAlert < this.alertCooldownTime) {
                    console.log(`🔕 Alert spam prevention: ${alertData.type} alert suppressed`);
                    return;
                }
            }
            
            // Set new cooldown
            this.alertCooldowns.set(alertKey, now);
            
            // Add to alert history
            this.alertHistory.unshift({
                ...alertData,
                viewerTimestamp: now
            });
            
            // Limit history size
            if (this.alertHistory.length > this.maxAlertHistory) {
                this.alertHistory = this.alertHistory.slice(0, this.maxAlertHistory);
            }
            
            // Show the alert notification
            this.showSecurityAlertNotification(alertData);
            
            // Play alert sound
            this.playAlertSound(alertData.type);
            
            // Update UI with alert indicator
            this.updateAlertIndicator(alertData);
            
            console.log(`🚨 Security alert processed: ${alertData.type} from ${alertData.cameraName}`);
            
        } catch (error) {
            console.error('Error handling security alert:', error);
        }
    }

    showSecurityAlertNotification(alertData) {
        // Create alert notification element
        const notification = document.createElement('div');
        notification.className = 'security-alert-notification';
        
        const alertEmoji = alertData.type === 'motion' ? '👁️' : '🔊';
        const alertColor = alertData.type === 'motion' ? '#ff6b35' : '#ffd700';
        
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${alertColor};
                color: #000;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                z-index: 9999;
                max-width: 350px;
                animation: alertSlideIn 0.3s ease-out;
                border-left: 5px solid #d32f2f;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span style="font-size: 18px; margin-right: 8px;">${alertEmoji}</span>
                    <strong>SECURITY ALERT</strong>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer; color: #000;">×</button>
                </div>
                <div style="font-size: 12px; margin-bottom: 3px;">
                    📹 ${alertData.cameraName}
                </div>
                <div style="font-size: 13px;">
                    ${alertData.message}
                </div>
                <div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">
                    🕒 ${new Date(alertData.timestamp).toLocaleTimeString()}
                </div>
            </div>
            <style>
                @keyframes alertSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove notification after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 8000);
    }

    playAlertSound(alertType) {
        try {
            // Create audio context if needed
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Generate different tones for different alert types
            const frequency = alertType === 'motion' ? 800 : 600;
            const duration = 0.2;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
            
            // Double beep for motion alerts
            if (alertType === 'motion') {
                setTimeout(() => {
                    const oscillator2 = this.audioContext.createOscillator();
                    const gainNode2 = this.audioContext.createGain();
                    
                    oscillator2.connect(gainNode2);
                    gainNode2.connect(this.audioContext.destination);
                    
                    oscillator2.frequency.setValueAtTime(frequency + 200, this.audioContext.currentTime);
                    oscillator2.type = 'sine';
                    
                    gainNode2.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gainNode2.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
                    gainNode2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
                    
                    oscillator2.start(this.audioContext.currentTime);
                    oscillator2.stop(this.audioContext.currentTime + duration);
                }, 300);
            }
            
        } catch (error) {
            console.log('Alert sound failed:', error);
        }
    }

    updateAlertIndicator(alertData) {
        // Update status bar with alert info
        const originalStatus = this.status.textContent;
        const alertEmoji = alertData.type === 'motion' ? '👁️' : '🔊';
        
        this.updateStatus(`🚨 ${alertEmoji} ${alertData.type.toUpperCase()} ALERT - ${alertData.cameraName}`, 'warning');
        
        // Revert to original status after 5 seconds
        setTimeout(() => {
            if (this.status.textContent.includes('ALERT')) {
                this.updateStatus(originalStatus, this.isConnected ? 'connected' : 'disconnected');
            }
        }, 5000);
        
        // Flash the video border for visual alert
        if (this.remoteVideo && this.isConnected) {
            const originalBorder = this.remoteVideo.style.border;
            const alertColor = alertData.type === 'motion' ? '#ff6b35' : '#ffd700';
            
            this.remoteVideo.style.border = `3px solid ${alertColor}`;
            this.remoteVideo.style.boxShadow = `0 0 20px ${alertColor}`;
            
            setTimeout(() => {
                this.remoteVideo.style.border = originalBorder;
                this.remoteVideo.style.boxShadow = '';
            }, 2000);
        }
    }

    updateSecurityAlertsStatus(statusData) {
        this.securityAlertsEnabled = statusData.enabled;
        
        // Always show alert controls when connected to camera so user can enable/disable alerts
        this.ensureAlertControlsVisible();
        
        // Update activation UI based on current status
        this.updateSecurityActivationUI(statusData.enabled);
        
        // Update UI to show alert status
        let alertStatusIndicator = document.getElementById('alertStatusIndicator');
        
        if (statusData.enabled && !alertStatusIndicator) {
            alertStatusIndicator = document.createElement('div');
            alertStatusIndicator.id = 'alertStatusIndicator';
            alertStatusIndicator.innerHTML = `
                <div style="
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    background: #28a745;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                ">
                    🛡️ Security Alerts: ON
                    ${statusData.motionEnabled ? '👁️' : ''} 
                    ${statusData.audioEnabled ? '🔊' : ''}
                </div>
            `;
            document.body.appendChild(alertStatusIndicator);
        } else if (!statusData.enabled && alertStatusIndicator) {
            alertStatusIndicator.remove();
        } else if (statusData.enabled && alertStatusIndicator) {
            // Update existing indicator
            alertStatusIndicator.innerHTML = `
                <div style="
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    background: #28a745;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                ">
                    🛡️ Security Alerts: ON
                    ${statusData.motionEnabled ? '👁️' : ''} 
                    ${statusData.audioEnabled ? '🔊' : ''}
                </div>
            `;
        }
        
        console.log(`🛡️ Security alerts ${statusData.enabled ? 'enabled' : 'disabled'} for this camera`);
    }

    // Method to show alert history (can be called from console or UI)
    showAlertHistory() {
        console.table(this.alertHistory.map(alert => ({
            Time: new Date(alert.timestamp).toLocaleTimeString(),
            Type: alert.type,
            Camera: alert.cameraName,
            Message: alert.message,
            Intensity: alert.intensity || alert.volume || 'N/A'
        })));
        
        return this.alertHistory;
    }

    // Method to send alert settings to camera
    updateCameraAlertSettings(settings) {
        console.log('📤 updateCameraAlertSettings called - socket:', !!this.socket, 'isConnected:', this.isConnected, 'currentCamera:', !!this.currentCamera);
        
        if (this.socket && this.currentCamera) {
            this.socket.emit('update-alert-settings', {
                ...settings,
                targetRoomId: this.currentCamera.roomId
            });
            console.log('🔧 Sent alert settings to camera:', settings, 'Room:', this.currentCamera.roomId);
        } else {
            console.warn('Cannot send alert settings - socket:', !!this.socket, 'currentCamera:', !!this.currentCamera);
            alert('Please connect to a camera first before changing alert settings');
        }
    }

    clearAlertHistory() {
        this.alertHistory = [];
        this.updateAlertHistoryUI();
        console.log('🗑️ Alert history cleared');
    }

    updateAlertHistoryUI() {
        const alertHistoryDiv = document.getElementById('alertHistory');
        if (!alertHistoryDiv) return;

        if (this.alertHistory.length === 0) {
            alertHistoryDiv.innerHTML = '<div class="no-alerts">No alerts yet</div>';
            return;
        }

        const recentAlerts = this.alertHistory.slice(0, 10); // Show last 10 alerts
        alertHistoryDiv.innerHTML = recentAlerts.map(alert => {
            const time = new Date(alert.timestamp).toLocaleTimeString();
            const emoji = alert.type === 'motion' ? '👁️' : '🔊';
            const intensity = alert.intensity || alert.volume || 'N/A';
            
            return `
                <div class="alert-item">
                    <div class="alert-header">
                        <span class="alert-type">${emoji} ${alert.type.toUpperCase()}</span>
                        <span class="alert-time">${time}</span>
                    </div>
                    <div class="alert-details">
                        <strong>${alert.cameraName}</strong>
                        <br>Intensity: ${typeof intensity === 'number' ? Math.round(intensity * 100) + '%' : intensity}
                    </div>
                </div>
            `;
        }).join('');
    }

    showAlertSettings() {
        console.log('🔧 showAlertSettings called - isConnected:', this.isConnected, 'currentCamera:', this.currentCamera);
        
        // Ensure alert controls are visible before showing dialog
        this.ensureAlertControlsVisible();
        
        if (!this.currentCamera) {
            alert('Please connect to a camera first');
            return;
        }

        // Use current settings if available, otherwise use defaults
        const settings = this.currentAlertSettings || {
            motionEnabled: false,
            audioEnabled: false,
            motionSensitivity: 0.3,
            audioSensitivity: 0.7,
            cooldownSeconds: 10
        };

        // Create a simple alert settings dialog
        const settingsDialog = document.createElement('div');
        settingsDialog.id = 'alertSettingsDialog';
        settingsDialog.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    max-width: 450px;
                    width: 90%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 20px 0; color: #dc3545;">⚙️ Remote Alert Settings</h3>
                    <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                        📹 Controlling: <strong>${this.currentCamera.name}</strong>
                    </p>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="dialogMotionEnabled" ${settings.motionEnabled ? 'checked' : ''}> 
                            👁️ Motion Detection
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding-left: 20px;">
                        <label>Motion Sensitivity:</label>
                        <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
                            <input type="range" id="dialogMotionSensitivity" min="0.1" max="0.8" step="0.1" value="${settings.motionSensitivity}" style="flex: 1;">
                            <span id="dialogMotionValue" style="min-width: 30px; font-weight: bold;">${settings.motionSensitivity}</span>
                        </div>
                        <small style="color: #666;">0.1 = Very Sensitive, 0.8 = Less Sensitive</small>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="dialogAudioEnabled" ${settings.audioEnabled ? 'checked' : ''}> 
                            🔊 Audio Detection
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding-left: 20px;">
                        <label>Audio Sensitivity:</label>
                        <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
                            <input type="range" id="dialogAudioSensitivity" min="0.1" max="0.9" step="0.1" value="${settings.audioSensitivity}" style="flex: 1;">
                            <span id="dialogAudioValue" style="min-width: 30px; font-weight: bold;">${settings.audioSensitivity}</span>
                        </div>
                        <small style="color: #666;">0.3 = Very Sensitive, 0.9 = Less Sensitive</small>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label>Alert Cooldown (seconds):</label>
                        <input type="number" id="dialogAlertCooldown" min="5" max="60" value="${settings.cooldownSeconds}" 
                               style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
                        <small style="color: #666;">Minimum time between alerts of the same type</small>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="document.getElementById('alertSettingsDialog').remove()" 
                                style="padding: 10px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            Cancel
                        </button>
                        <button onclick="CCTVViewer.instance.applyAlertSettings()" 
                                style="padding: 10px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            Apply Settings
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(settingsDialog);
        
        // Add real-time value updates for sliders
        const motionSlider = document.getElementById('dialogMotionSensitivity');
        const audioSlider = document.getElementById('dialogAudioSensitivity');
        const motionValue = document.getElementById('dialogMotionValue');
        const audioValue = document.getElementById('dialogAudioValue');

        if (motionSlider && motionValue) {
            motionSlider.addEventListener('input', (e) => {
                motionValue.textContent = e.target.value;
            });
        }

        if (audioSlider && audioValue) {
            audioSlider.addEventListener('input', (e) => {
                audioValue.textContent = e.target.value;
            });
        }
        
        // Store instance reference for the onclick handler
        if (!CCTVViewer.instance) {
            CCTVViewer.instance = this;
        }
        
        // Add debug method to window for testing
        window.debugActivateAlerts = () => {
            console.log('🔍 Debug activation test');
            this.activateSecurityAlerts();
        };
        
        window.debugShowSecurityPanel = () => {
            const securityActivation = document.getElementById('securityActivation');
            if (securityActivation) {
                securityActivation.style.display = 'block';
                console.log('🔍 Debug: Security panel shown manually');
            } else {
                console.log('🔍 Debug: Security panel element not found');
            }
        };
    }

    applyAlertSettings() {
        const motionEnabled = document.getElementById('dialogMotionEnabled').checked;
        const audioEnabled = document.getElementById('dialogAudioEnabled').checked;
        const motionSensitivity = parseFloat(document.getElementById('dialogMotionSensitivity').value);
        const audioSensitivity = parseFloat(document.getElementById('dialogAudioSensitivity').value);
        const cooldownSeconds = parseInt(document.getElementById('dialogAlertCooldown').value);

        const settings = {
            motionEnabled,
            audioEnabled,
            motionSensitivity,
            audioSensitivity,
            cooldownSeconds
        };

        // Update current settings in viewer to persist changes
        this.currentAlertSettings = settings;

        // Send to camera
        this.updateCameraAlertSettings(settings);
        
        // Close dialog
        const dialog = document.getElementById('alertSettingsDialog');
        if (dialog) {
            dialog.remove();
        }

        // Ensure alert controls remain visible
        this.ensureAlertControlsVisible();

        console.log('🔧 Applied alert settings:', settings);
    }

    // Activate security alerts with default settings
    activateSecurityAlerts() {
        console.log('🚀 activateSecurityAlerts() called - currentCamera:', this.currentCamera);
        
        if (!this.currentCamera) {
            alert('Please connect to a camera first');
            return;
        }

        // Show immediate feedback
        const activateBtn = document.getElementById('activateSecurityBtn');
        if (activateBtn) {
            activateBtn.textContent = '⏳ Activating...';
            activateBtn.disabled = true;
        }

        // Default settings for quick activation
        const defaultSettings = {
            motionEnabled: true,
            audioEnabled: true,
            motionSensitivity: 0.3,
            audioSensitivity: 0.7,
            cooldownSeconds: 10
        };

        console.log('📤 Sending activation settings to camera:', defaultSettings);

        // Update current settings
        this.currentAlertSettings = defaultSettings;

        // Send to camera
        this.updateCameraAlertSettings(defaultSettings);
        
        // Update UI immediately
        this.updateSecurityActivationUI(true);
        
        // Reset button after delay
        setTimeout(() => {
            if (activateBtn) {
                activateBtn.textContent = '🚀 Activate Security Alerts';
                activateBtn.disabled = false;
            }
        }, 2000);

        console.log('🚀 Security alerts activation initiated with default settings:', defaultSettings);
    }

    // Deactivate security alerts
    deactivateSecurityAlerts() {
        console.log('⏹️ deactivateSecurityAlerts() called - currentCamera:', this.currentCamera);
        
        if (!this.currentCamera) {
            alert('Please connect to a camera first');
            return;
        }

        // Show immediate feedback
        const deactivateBtn = document.getElementById('deactivateSecurityBtn');
        if (deactivateBtn) {
            deactivateBtn.textContent = '⏳ Deactivating...';
            deactivateBtn.disabled = true;
        }

        // Settings to disable all alerts
        const disableSettings = {
            motionEnabled: false,
            audioEnabled: false,
            motionSensitivity: 0.3,
            audioSensitivity: 0.7,
            cooldownSeconds: 10
        };

        console.log('📤 Sending deactivation settings to camera:', disableSettings);

        // Update current settings
        this.currentAlertSettings = disableSettings;

        // Send to camera
        this.updateCameraAlertSettings(disableSettings);
        
        // Update UI immediately
        this.updateSecurityActivationUI(false);
        
        // Reset button after delay
        setTimeout(() => {
            if (deactivateBtn) {
                deactivateBtn.textContent = '⏹️ Deactivate Security Alerts';
                deactivateBtn.disabled = false;
            }
        }, 2000);

        console.log('⏹️ Security alerts deactivation initiated');
    }

    // Update the security activation UI
    updateSecurityActivationUI(isActive) {
        const activationStatus = document.getElementById('activationStatus');
        const activateBtn = document.getElementById('activateSecurityBtn');
        const deactivateBtn = document.getElementById('deactivateSecurityBtn');
        
        if (activationStatus) {
            activationStatus.className = `activation-status ${isActive ? 'active' : 'inactive'}`;
            activationStatus.innerHTML = `<span class="status-text">${isActive ? 'Active' : 'Inactive'}</span>`;
        }
        
        if (activateBtn) {
            activateBtn.style.display = isActive ? 'none' : 'inline-block';
        }
        
        if (deactivateBtn) {
            deactivateBtn.style.display = isActive ? 'inline-block' : 'none';
        }
        
        console.log('🎨 Security activation UI updated - Active:', isActive);
    }

    // Override handleSecurityAlert to update UI
    handleSecurityAlert(alertData) {
        // Call parent method
        try {
            // Check if this alert type is in cooldown to prevent spam
            const alertKey = `${alertData.type}_${alertData.roomId}`;
            const now = Date.now();
            
            if (this.alertCooldowns.has(alertKey)) {
                const lastAlert = this.alertCooldowns.get(alertKey);
                if (now - lastAlert < this.alertCooldownTime) {
                    console.log(`🔕 Alert spam prevention: ${alertData.type} alert suppressed`);
                    return;
                }
            }
            
            // Set new cooldown
            this.alertCooldowns.set(alertKey, now);
            
            // Add to alert history
            this.alertHistory.unshift({
                ...alertData,
                viewerTimestamp: now
            });
            
            // Limit history size
            if (this.alertHistory.length > this.maxAlertHistory) {
                this.alertHistory = this.alertHistory.slice(0, this.maxAlertHistory);
            }
            
            // Update alert history UI
            this.updateAlertHistoryUI();
            
            // Show the alert notification
            this.showSecurityAlertNotification(alertData);
            
            // Play alert sound
            this.playAlertSound(alertData.type);
            
            // Update UI with alert indicator
            this.updateAlertIndicator(alertData);
            
            console.log(`🚨 Security alert processed: ${alertData.type} from ${alertData.cameraName}`);
            
        } catch (error) {
            console.error('Error handling security alert:', error);
        }
    }

    // ==================== END SECURITY ALERT SYSTEM ====================
    // ==================== SPEAK MODE FUNCTIONALITY ====================

    async startSpeakMode() {
        if (!this.isConnected || !this.currentCamera) {
            alert('Please connect to a camera first');
            return;
        }

        if (this.isSpeaking) {
            console.log('Already in speak mode');
            return;
        }

        try {
            console.log('🎤 Starting speak mode...');
            this.updateSpeakStatus('Requesting microphone access...', false);

            // Get microphone stream
            this.speakStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create a separate peer connection for audio streaming
            this.speakPeerConnection = new RTCPeerConnection({
                iceServers: [
                    // Local STUN/TURN servers (high priority)
                    { urls: 'stun:139.162.61.4:3478' },
                    { urls: 'turn:139.162.61.4:3478' },
                    { urls: 'turn:139.162.61.4:3479' },
                    
                    // Google STUN servers (fallback)
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    
                    // Additional STUN servers for better reliability
                    { urls: 'stun:stun.services.mozilla.com' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    
                    // Public TURN servers (last resort)
                    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
                    { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
                ],
                iceCandidatePoolSize: 10
            });

            // Add audio tracks to the peer connection
            this.speakStream.getTracks().forEach(track => {
                this.speakPeerConnection.addTrack(track, this.speakStream);
            });

            // Handle ICE candidates for speak mode
            this.speakPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('speak-ice-candidate', {
                        roomId: this.currentCamera.roomId,
                        candidate: event.candidate
                    });
                }
            };

            // Handle connection state changes
            this.speakPeerConnection.onconnectionstatechange = () => {
                console.log('Speak connection state:', this.speakPeerConnection.connectionState);
                
                switch (this.speakPeerConnection.connectionState) {
                    case 'connected':
                        this.isSpeaking = true;
                        this.updateSpeakStatus('Speaking', true);
                        break;
                    case 'disconnected':
                    case 'failed':
                    case 'closed':
                        if (this.isSpeaking) {
                            this.stopSpeakMode();
                        }
                        break;
                }
            };

            // Create and send speak offer
            const offer = await this.speakPeerConnection.createOffer();
            await this.speakPeerConnection.setLocalDescription(offer);

            this.socket.emit('speak-offer', {
                roomId: this.currentCamera.roomId,
                offer: offer
            });

            this.updateSpeakStatus('Connecting...', false);
            console.log('🎤 Speak offer sent to camera');

        } catch (error) {
            console.error('Error starting speak mode:', error);
            this.updateSpeakStatus('Failed to access microphone', false);
            
            // Show user-friendly error
            if (error.name === 'NotAllowedError') {
                alert('Microphone access denied. Please allow microphone access to use speak mode.');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone to use speak mode.');
            } else {
                alert('Failed to start speak mode. Please try again.');
            }
            
            this.cleanupSpeakMode();
        }
    }

    stopSpeakMode() {
        if (!this.isSpeaking && !this.speakStream) {
            return;
        }

        console.log('🎤 Stopping speak mode...');

        try {
            // Stop all audio tracks
            if (this.speakStream) {
                this.speakStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.speakStream = null;
            }

            // Close peer connection
            if (this.speakPeerConnection) {
                this.speakPeerConnection.close();
                this.speakPeerConnection = null;
            }

            // Notify camera to stop receiving audio
            if (this.isConnected && this.currentCamera) {
                this.socket.emit('speak-stop', {
                    roomId: this.currentCamera.roomId
                });
            }

            this.cleanupSpeakMode();
            console.log('🎤 Speak mode stopped');

        } catch (error) {
            console.error('Error stopping speak mode:', error);
            this.cleanupSpeakMode();
        }
    }

    cleanupSpeakMode() {
        this.isSpeaking = false;
        this.updateSpeakStatus('Ready', false);
    }

    updateSpeakStatus(message, isSpeaking) {
        if (this.speakStatus) {
            this.speakStatus.className = `speak-status ${isSpeaking ? 'speaking' : ''}`;
            this.speakStatus.innerHTML = `<span class="status-text">${message}</span>`;
        }

        if (this.startSpeakBtn && this.stopSpeakBtn) {
            this.startSpeakBtn.style.display = isSpeaking ? 'none' : 'inline-block';
            this.stopSpeakBtn.style.display = isSpeaking ? 'inline-block' : 'none';
        }
    }

    handleSpeakAnswer(answer) {
        try {
            if (this.speakPeerConnection) {
                this.speakPeerConnection.setRemoteDescription(answer);
                console.log('🎤 Speak answer processed');
            }
        } catch (error) {
            console.error('Error handling speak answer:', error);
        }
    }

    async handleSpeakIceCandidate(candidate) {
        try {
            if (this.speakPeerConnection) {
                await this.speakPeerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Error handling speak ICE candidate:', error);
        }
    }

    // ==================== END SPEAK MODE FUNCTIONALITY ====================
}

// Initialize the viewer when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CCTVViewer();
});