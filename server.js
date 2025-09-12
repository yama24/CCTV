const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Simple in-memory user store (in production, use a proper database)
const users = {
    admin: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password: "password"
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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

// API endpoint to get active cameras
app.get('/api/cameras', requireAuth, (req, res) => {
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

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a room (camera or viewer)
    socket.on('join-room', (data) => {
        const { roomId, role, cameraName, deviceInfo } = data; // role: 'camera' or 'viewer'
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
        socket.to(data.target).emit('offer', {
            offer: data.offer,
            sender: socket.id
        });
    });

    socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', {
            answer: data.answer,
            sender: socket.id
        });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', {
            candidate: data.candidate,
            sender: socket.id
        });
    });

    // Request offer from camera
    socket.on('request-offer', () => {
        if (socket.role === 'viewer' && socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room && room.camera) {
                io.to(room.camera).emit('viewer-requesting-offer', {
                    viewerId: socket.id
                });
            }
        }
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