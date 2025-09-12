const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';

// Simple in-memory user store (in production, use a proper database)
const users = {
    admin: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password: "password"
};

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

// Session configuration
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.redirect('/login');
    }
};

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
    
    if (users[username] && await bcrypt.compare(password, users[username])) {
        req.session.authenticated = true;
        req.session.username = username;
        
        // Generate JWT token for WebSocket authentication
        const token = jwt.sign(
            { username: username, authenticated: true },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Store token in session for client-side access
        req.session.authToken = token;
        
        res.redirect('/camera');
    } else {
        res.redirect('/login?error=Invalid credentials');
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
        { username: req.session.username, authenticated: true },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    // Update session with fresh token
    req.session.authToken = token;
    
    res.json({ token });
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
    const cameraList = Array.from(cameras.entries()).map(([roomId, info]) => ({
        roomId,
        name: info.name,
        deviceInfo: info.deviceInfo,
        connectedAt: info.connectedAt,
        status: info.status
    }));
    res.json(cameraList);
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
                status: 'active'
            });
            console.log(`Camera "${cameraName}" joined room ${roomId}`);
            // Notify all connected clients about camera list update
            io.emit('cameras-updated', Array.from(cameras.entries()).map(([id, info]) => ({
                roomId: id,
                ...info
            })));
        } else if (role === 'viewer') {
            room.viewers.push(socket.id);
            console.log(`Viewer joined room ${roomId}`);
            // Send current camera list to the new viewer
            socket.emit('cameras-updated', Array.from(cameras.entries()).map(([id, info]) => ({
                roomId: id,
                ...info
            })));
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
                room.camera = null;
                // Remove from cameras list
                cameras.delete(socket.roomId);
                // Notify all viewers that camera is disconnected
                socket.to(socket.roomId).emit('camera-disconnected');
                // Notify all clients about camera list update
                io.emit('cameras-updated', Array.from(cameras.entries()).map(([id, info]) => ({
                    roomId: id,
                    ...info
                })));
            } else if (socket.role === 'viewer') {
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