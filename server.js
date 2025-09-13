const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');
const Database = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';

// IMPORTANT: Trust proxy headers to prevent redirect loops
app.set('trust proxy', 1);

// Initialize database
const db = new Database();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom static file middleware that protects sensitive files
app.use((req, res, next) => {
    // Protected files that require authentication (excluding CSS for login page)
    const protectedPaths = ['/js/camera.js', '/js/viewer.js'];
    
    if (protectedPaths.some(path => req.path === path)) {
        // These files are handled by specific authenticated routes
        return next();
    }
    
    // Serve other static files normally
    express.static('public')(req, res, next);
});

// Session configuration - auto-detect HTTPS when behind proxy
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: 'auto',  // Automatically detect HTTPS
        maxAge: 24 * 60 * 60 * 1000 * 100, // 24 hours * 100
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.redirect('/login');
    }
};

// Role-based authentication middleware
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.session || !req.session.authenticated) {
            return res.redirect('/login');
        }
        
        const userRole = req.session.userRole;
        
        // Admin has access to everything
        if (userRole === 'admin') {
            return next();
        }
        
        // Check if user has required role
        if (userRole !== requiredRole) {
            return res.status(403).send(`
                <h1>🚫 Access Denied</h1>
                <p>You need <strong>${requiredRole}</strong> privileges to access this resource.</p>
                <p>Your role: <strong>${userRole}</strong></p>
                <a href="/camera">← Back to Camera</a>
            `);
        }
        
        next();
    };
};

// Admin-only middleware
const requireAdmin = requireRole('admin');

// JWT token validation middleware
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Middleware for API authentication
const requireApiAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = decoded;
    next();
};

// Routes
app.get('/', (req, res) => {
    res.redirect('/camera');
});

app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/camera');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    
    try {
        // Log login attempt
        db.logLoginAttempt({
            username,
            ipAddress: clientIP,
            userAgent,
            success: false,
            errorMessage: null
        }, () => {});
        
        // Check for rate limiting
        db.getRecentLoginAttempts(username, clientIP, 15, (err, attempts) => {
            if (err) {
                console.error('Error checking login attempts:', err);
                return res.redirect('/login?error=Server error');
            }
            
            const failedAttempts = attempts.filter(attempt => !attempt.success).length;
            if (failedAttempts >= 5) {
                db.logLoginAttempt({
                    username,
                    ipAddress: clientIP,
                    userAgent,
                    success: false,
                    errorMessage: 'Too many failed attempts'
                }, () => {});
                
                return res.redirect('/login?error=Too many failed attempts. Please try again later.');
            }
            
            // Check user credentials
            db.getUserByUsername(username, async (err, user) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.redirect('/login?error=Server error');
                }
                
                if (!user) {
                    db.logLoginAttempt({
                        username,
                        ipAddress: clientIP,
                        userAgent,
                        success: false,
                        errorMessage: 'User not found'
                    }, () => {});
                    
                    return res.redirect('/login?error=Invalid credentials');
                }
                
                // Verify password
                const passwordMatch = await bcrypt.compare(password, user.password_hash);
                
                if (passwordMatch) {
                    // Successful login
                    req.session.authenticated = true;
                    req.session.username = user.username;
                    req.session.userId = user.id;
                    req.session.userRole = user.role;
                    
                    // Generate JWT token for WebSocket authentication
                    const token = jwt.sign(
                        { 
                            username: user.username, 
                            userId: user.id,
                            role: user.role,
                            authenticated: true 
                        },
                        JWT_SECRET,
                        { expiresIn: '24h' }
                    );
                    
                    // Store token in session for client-side access
                    req.session.authToken = token;
                    
                    // Update last login time
                    db.updateUserLastLogin(user.id, () => {});
                    
                    // Log successful login
                    db.logLoginAttempt({
                        username,
                        ipAddress: clientIP,
                        userAgent,
                        success: true,
                        errorMessage: null
                    }, () => {});
                    
                    res.redirect('/camera');
                } else {
                    db.logLoginAttempt({
                        username,
                        ipAddress: clientIP,
                        userAgent,
                        success: false,
                        errorMessage: 'Invalid password'
                    }, () => {});
                    
                    res.redirect('/login?error=Invalid credentials');
                }
            });
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.redirect('/login?error=Server error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/camera', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera.html'));
});

app.get('/viewer', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

// Admin-only routes
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/users', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-users.html'));
});


app.get('/admin/logs', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-logs.html'));
});

app.get('/admin/stats', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-stats.html'));
});

// Secure access to JavaScript files - require authentication
app.get('/js/camera.js', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'camera.js'));
});

app.get('/js/viewer.js', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'viewer.js'));
});

// CSS files should be accessible for login page
app.get('/css/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'css', 'style.css'));
});

// API endpoint to get authentication token for WebSocket connections
app.get('/api/auth/token', requireAuth, (req, res) => {
    // Always generate a fresh token to ensure it's valid
    const token = jwt.sign(
        { 
            username: req.session.username, 
            userId: req.session.userId,
            role: req.session.userRole,
            authenticated: true 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    // Update session with fresh token
    req.session.authToken = token;
    
    res.json({ token });
});

// API endpoint to get current user information
app.get('/api/auth/user', requireAuth, (req, res) => {
    res.json({
        username: req.session.username,
        userId: req.session.userId,
        role: req.session.userRole,
        authenticated: true
    });
});

// API endpoint to validate token
app.post('/api/auth/validate', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    
    if (!token) {
        return res.status(401).json({ valid: false, error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    if (decoded) {
        res.json({ valid: true, user: decoded });
    } else {
        res.status(401).json({ valid: false, error: 'Invalid or expired token' });
    }
});

// API endpoint to get active cameras
app.get('/api/cameras', requireApiAuth, (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    let cameraList = Array.from(cameras.entries()).map(([roomId, info]) => ({
        roomId,
        name: info.name,
        deviceInfo: info.deviceInfo,
        connectedAt: info.connectedAt,
        status: info.status,
        userId: info.userId,
        // Only show owner info to admins
        ...(userRole === 'admin' && { 
            ownerInfo: `User ID: ${info.userId}` 
        })
    }));
    
    // Filter cameras based on user role
    if (userRole !== 'admin') {
        // Non-admin users can only see their own cameras
        cameraList = cameraList.filter(camera => camera.userId === userId);
    }
    
    res.json(cameraList);
});

// Admin-only API endpoints
app.get('/api/admin/users', requireApiAuth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.db.all(
        'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC',
        (err, users) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(users);
        }
    );
});

app.get('/api/admin/logs', requireApiAuth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    db.db.all(
        `SELECT cl.*, u.username 
         FROM camera_logs cl 
         JOIN users u ON cl.user_id = u.id 
         ORDER BY cl.timestamp DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, logs) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(logs);
        }
    );
});

app.get('/api/admin/stats', requireApiAuth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Get comprehensive statistics
    const queries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users',
        activeUsers: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
        adminUsers: 'SELECT COUNT(*) as count FROM users WHERE role = "admin"',
        activeSessions: 'SELECT COUNT(*) as count FROM sessions WHERE is_active = 1 AND expires_at > datetime("now")',
        activities24h: 'SELECT COUNT(*) as count FROM camera_logs WHERE timestamp > datetime("now", "-24 hours")',
        failedLogins24h: 'SELECT COUNT(*) as count FROM login_attempts WHERE success = 0 AND timestamp > datetime("now", "-24 hours")',
        topCameras: `SELECT room_id, camera_name, COUNT(*) as sessions 
                     FROM camera_logs 
                     WHERE action = "camera_connected" 
                     GROUP BY room_id 
                     ORDER BY sessions DESC 
                     LIMIT 10`
    };
    
    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        if (key === 'topCameras') {
            db.db.all(query, (err, rows) => {
                results[key] = err ? [] : rows;
                completed++;
                if (completed === total) {
                    res.json(results);
                }
            });
        } else {
            db.db.get(query, (err, row) => {
                results[key] = err ? 0 : (row?.count || 0);
                completed++;
                if (completed === total) {
                    res.json(results);
                }
            });
        }
    });
});

// WebRTC signaling
const rooms = new Map();
const cameras = new Map(); // Track camera metadata

// WebSocket authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
        return next(new Error('Authentication token required'));
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return next(new Error('Invalid or expired authentication token'));
    }
    
    socket.user = decoded;
    next();
});

io.on('connection', (socket) => {
    console.log('Authenticated client connected:', socket.id, 'User:', socket.user.username);

    // Join a room (camera or viewer)
    socket.on('join-room', (data) => {
        const { roomId, role, cameraName, deviceInfo } = data; // role: 'camera' or 'viewer'
        
        // Double-check authentication for critical operations
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        // Check access permissions for viewers
        if (role === 'viewer') {
            const existingCamera = cameras.get(roomId);
            if (existingCamera) {
                // Non-admin users can only view their own cameras
                if (socket.user.role !== 'admin' && existingCamera.userId !== socket.user.userId) {
                    socket.emit('error', { 
                        message: 'Access denied: You can only view your own cameras' 
                    });
                    return;
                }
            } else {
                // Camera doesn't exist
                socket.emit('error', { 
                    message: 'Camera not found or not currently active' 
                });
                return;
            }
        }
        
        socket.join(roomId);
        socket.role = role;
        socket.roomId = roomId;

        if (!rooms.has(roomId)) {
            rooms.set(roomId, { camera: null, viewers: [] });
        }

        const room = rooms.get(roomId);

        if (role === 'camera') {
            room.camera = socket.id;
            // Store camera metadata
            cameras.set(roomId, {
                socketId: socket.id,
                name: cameraName || `Camera ${roomId}`,
                deviceInfo: deviceInfo || 'Unknown device',
                connectedAt: new Date(),
                status: 'active',
                userId: socket.user.userId
            });
            
            // Log camera connection
            db.logCameraActivity({
                roomId,
                cameraName: cameraName || `Camera ${roomId}`,
                deviceInfo: deviceInfo || 'Unknown device',
                userId: socket.user.userId,
                action: 'camera_connected',
                ipAddress: socket.handshake.address,
                duration: null
            }, () => {});
            
            console.log(`Camera "${cameraName}" joined room ${roomId} by user ${socket.user.username}`);
            // Notify clients about camera list update (filtered per user)
            io.sockets.sockets.forEach((clientSocket) => {
                if (clientSocket.user && clientSocket.user.authenticated) {
                    let userCameras = Array.from(cameras.entries()).map(([id, info]) => ({
                        roomId: id,
                        ...info
                    }));
                    
                    // Filter cameras for non-admin users
                    if (clientSocket.user.role !== 'admin') {
                        userCameras = userCameras.filter(cam => cam.userId === clientSocket.user.userId);
                    }
                    
                    clientSocket.emit('cameras-updated', userCameras);
                }
            });
        } else if (role === 'viewer') {
            room.viewers.push(socket.id);
            
            // Log viewer connection
            db.logCameraActivity({
                roomId,
                cameraName: cameras.get(roomId)?.name || 'Unknown camera',
                deviceInfo: 'Viewer connection',
                userId: socket.user.userId,
                action: 'viewer_connected',
                ipAddress: socket.handshake.address,
                duration: null
            }, () => {});
            
            console.log(`Viewer joined room ${roomId} by user ${socket.user.username}`);
            // Send current camera list to the new viewer (filtered by ownership)
            let userCameras = Array.from(cameras.entries()).map(([id, info]) => ({
                roomId: id,
                ...info
            }));
            
            // Filter cameras for non-admin users
            if (socket.user.role !== 'admin') {
                userCameras = userCameras.filter(cam => cam.userId === socket.user.userId);
            }
            
            socket.emit('cameras-updated', userCameras);
            // If camera is already in room, notify viewer
            if (room.camera) {
                socket.emit('camera-available');
            }
        }
    });

    // WebRTC signaling messages
    socket.on('offer', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        // Verify the user has access to the camera in this room
        if (socket.role === 'camera' && socket.roomId) {
            const cameraInfo = cameras.get(socket.roomId);
            if (cameraInfo && socket.user.role !== 'admin' && cameraInfo.userId !== socket.user.userId) {
                socket.emit('error', { message: 'Access denied: Not your camera' });
                return;
            }
        }
        
        socket.to(data.target).emit('offer', {
            offer: data.offer,
            sender: socket.id
        });
    });

    socket.on('answer', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        // Verify the user has access to view the camera in this room
        if (socket.role === 'viewer' && socket.roomId) {
            const cameraInfo = cameras.get(socket.roomId);
            if (cameraInfo && socket.user.role !== 'admin' && cameraInfo.userId !== socket.user.userId) {
                socket.emit('error', { message: 'Access denied: Not your camera' });
                return;
            }
        }
        
        socket.to(data.target).emit('answer', {
            answer: data.answer,
            sender: socket.id
        });
    });

    socket.on('ice-candidate', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        // Verify access to the room/camera
        if (socket.roomId) {
            const cameraInfo = cameras.get(socket.roomId);
            if (cameraInfo && socket.user.role !== 'admin' && cameraInfo.userId !== socket.user.userId) {
                socket.emit('error', { message: 'Access denied: Not your camera' });
                return;
            }
        }
        
        socket.to(data.target).emit('ice-candidate', {
            candidate: data.candidate,
            sender: socket.id
        });
    });

    // Request offer from camera
    socket.on('request-offer', () => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        if (socket.role === 'viewer' && socket.roomId) {
            const cameraInfo = cameras.get(socket.roomId);
            if (cameraInfo && socket.user.role !== 'admin' && cameraInfo.userId !== socket.user.userId) {
                socket.emit('error', { message: 'Access denied: Not your camera' });
                return;
            }
            
            const room = rooms.get(socket.roomId);
            if (room && room.camera) {
                io.to(room.camera).emit('viewer-requesting-offer', {
                    viewerId: socket.id
                });
            }
        }
    });

    // Device switching functionality
    socket.on('request-device-list', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        if (socket.role === 'viewer' && socket.roomId) {
            const cameraInfo = cameras.get(socket.roomId);
            if (cameraInfo && socket.user.role !== 'admin' && cameraInfo.userId !== socket.user.userId) {
                socket.emit('error', { message: 'Access denied: Not your camera' });
                return;
            }
            
            const room = rooms.get(socket.roomId);
            if (room && room.camera) {
                io.to(room.camera).emit('request-device-list', {
                    viewerId: socket.id
                });
            }
        }
    });

    socket.on('device-list', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        socket.to(data.target).emit('device-list', {
            devices: data.devices,
            sender: socket.id
        });
    });

    socket.on('switch-device-request', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        if (socket.role === 'viewer' && socket.roomId) {
            const cameraInfo = cameras.get(socket.roomId);
            if (cameraInfo && socket.user.role !== 'admin' && cameraInfo.userId !== socket.user.userId) {
                socket.emit('error', { message: 'Access denied: Not your camera' });
                return;
            }
            
            const room = rooms.get(socket.roomId);
            if (room && room.camera) {
                io.to(room.camera).emit('switch-device-request', {
                    deviceType: data.deviceType,
                    deviceId: data.deviceId,
                    viewerId: socket.id
                });
            }
        }
    });

    socket.on('device-switched', (data) => {
        if (!socket.user || !socket.user.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        socket.to(data.target).emit('device-switched', {
            deviceType: data.deviceType,
            deviceId: data.deviceId,
            success: data.success,
            error: data.error,
            sender: socket.id
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        if (socket.roomId && rooms.has(socket.roomId)) {
            const room = rooms.get(socket.roomId);
            
            if (socket.role === 'camera' && room.camera === socket.id) {
                const cameraInfo = cameras.get(socket.roomId);
                
                // Log camera disconnection
                if (cameraInfo && socket.user) {
                    const duration = Date.now() - new Date(cameraInfo.connectedAt).getTime();
                    db.logCameraActivity({
                        roomId: socket.roomId,
                        cameraName: cameraInfo.name,
                        deviceInfo: cameraInfo.deviceInfo,
                        userId: socket.user.userId,
                        action: 'camera_disconnected',
                        ipAddress: socket.handshake.address,
                        duration: Math.floor(duration / 1000) // Convert to seconds
                    }, () => {});
                }
                
                room.camera = null;
                // Remove from cameras list
                cameras.delete(socket.roomId);
                // Notify all viewers that camera is disconnected
                socket.to(socket.roomId).emit('camera-disconnected');
                // Notify all clients about camera list update (filtered per user)
                io.sockets.sockets.forEach((clientSocket) => {
                    if (clientSocket.user && clientSocket.user.authenticated) {
                        let userCameras = Array.from(cameras.entries()).map(([id, info]) => ({
                            roomId: id,
                            ...info
                        }));
                        
                        // Filter cameras for non-admin users
                        if (clientSocket.user.role !== 'admin') {
                            userCameras = userCameras.filter(cam => cam.userId === clientSocket.user.userId);
                        }
                        
                        clientSocket.emit('cameras-updated', userCameras);
                    }
                });
            } else if (socket.role === 'viewer') {
                // Log viewer disconnection
                if (socket.user) {
                    db.logCameraActivity({
                        roomId: socket.roomId,
                        cameraName: cameras.get(socket.roomId)?.name || 'Unknown camera',
                        deviceInfo: 'Viewer disconnection',
                        userId: socket.user.userId,
                        action: 'viewer_disconnected',
                        ipAddress: socket.handshake.address,
                        duration: null
                    }, () => {});
                }
                
                room.viewers = room.viewers.filter(id => id !== socket.id);
            }

            // Clean up empty rooms
            if (!room.camera && room.viewers.length === 0) {
                rooms.delete(socket.roomId);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CCTV Server running on port ${PORT}`);
    console.log(`Access your camera at: http://localhost:${PORT}/camera`);
    console.log(`Access viewer at: http://localhost:${PORT}/viewer`);
    console.log(`Default login: admin / password`);
});