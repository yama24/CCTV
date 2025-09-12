# Home CCTV WebRTC Streaming App

A secure home CCTV system that streams video and audio using WebRTC technology. Access your home camera feed from anywhere using ngrok tunneling.

## 🚀 Features

- **Multi-camera support** - Stream from multiple devices simultaneously
- **Camera selection** - Choose which camera to view from a list
- **Real-time streaming** with WebRTC (low latency)
- **Video and Audio** capture from your device camera and microphone
- **Secure authentication** to protect your stream
- **Multiple viewers** can watch simultaneously
- **Remote access** via ngrok tunneling
- **Mobile friendly** responsive design
- **Easy setup** with Node.js

## 📋 Prerequisites

- Node.js v22.14.0 or higher
- A device with camera and microphone (laptop, desktop with webcam, etc.)
- Modern web browser with WebRTC support
- ngrok account (free) for remote access

## 🛠️ Installation

1. **Clone or download** this project to your home device
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up initial admin user:**
   ```bash
   node scripts/setup-admin.js
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access locally:**
   - Open `http://localhost:3000` in your browser
   - Login with default credentials: `admin` / `password`

## 📁 Project Structure

```
├── server.js           # Main server application
├── database.js         # Database management
├── package.json        # Dependencies and scripts
├── config/            # Server configuration files
│   ├── apache2-vhost.conf
│   └── nginx-vhost.conf
├── docs/              # Documentation
│   ├── DATABASE_README.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── ...
├── public/            # Static web files
│   ├── *.html        # Web pages
│   ├── css/          # Stylesheets
│   └── js/           # Client-side JavaScript
├── scripts/           # Utility scripts
│   ├── setup-admin.js     # Initialize admin user
│   ├── user-manager.js    # Manage users
│   └── db-maintenance.js  # Database maintenance
└── tests/             # Testing scripts
    ├── test-security.js
    └── test-websocket-auth.js
```

## 🌐 Remote Access Setup (ngrok)

To access your CCTV from outside your home network:

1. **Install ngrok:**
   ```bash
   # Visit https://ngrok.com/ and sign up for free
   # Download and install ngrok for your platform
   ```

2. **Authenticate ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN
   ```

3. **Start ngrok tunnel** (in a separate terminal):
   ```bash
   ngrok http 3000
   ```

4. **Access remotely:**
   - ngrok will provide a URL like `https://abc123.ngrok.io`
   - Use this URL to access your CCTV from anywhere
   - Share this URL only with trusted users

## � Management Commands

### User Management
```bash
# Interactive user management menu
node scripts/user-manager.js

# Quick commands
node scripts/user-manager.js add    # Add user directly
node scripts/user-manager.js list   # List all users
```

### Database Maintenance
```bash
# Full maintenance (recommended weekly)
node scripts/db-maintenance.js

# Generate password hash
node scripts/generate-password.js

# Create demo users for testing
node scripts/create-demo-users.js
```

### Testing Security
```bash
# Test authentication endpoints
node tests/test-security.js

# Test WebSocket authentication  
node tests/test-websocket-auth.js
```

## �📱 Usage Instructions

### Setting up Multiple Cameras

1. **On each device** (laptop, phone, tablet, etc.):
   - **Login** to the system using your credentials
   - **Go to Camera page** (`/camera`)
   - **Enter a unique camera name** (e.g., "Living Room", "Front Door", "Kitchen")
   - **Add device description** (e.g., "Laptop Camera", "Phone Camera")
   - **Click "Start Camera"** and allow camera/microphone access
   - **Keep this page open** to maintain the stream

2. **Repeat on other devices** to set up multiple cameras

### Viewing Multiple Camera Streams

1. **Access the ngrok URL** from your remote device
2. **Login** with the same credentials
3. **Go to Viewer page** (`/viewer`)
4. **Select a camera** from the available cameras list
5. **Click "Connect to Selected Camera"** to start viewing
6. **Switch cameras** by disconnecting and selecting another camera

### Multi-Camera Tips

- **Use descriptive names** for each camera (Living Room, Bedroom, etc.)
- **Keep camera pages open** on each device to maintain streams
- **Only one viewer connection** per camera at a time
- **Cameras auto-refresh** when new ones come online
- **Mobile devices** work great as portable cameras

## 🔒 Security Considerations

### Default Setup
- **Change default password** immediately in production
- Default credentials: `admin` / `password`

### Production Security
1. **Update credentials** in `server.js`:
   ```javascript
   // Generate a new password hash
   const bcrypt = require('bcrypt');
   const newPassword = await bcrypt.hash('your-new-password', 10);
   ```

2. **Use HTTPS** with proper SSL certificates
3. **Configure firewall** rules if needed
4. **Use strong passwords** and consider 2FA
5. **Regularly update** dependencies

## ⚙️ Configuration

### Change Room ID
Edit the `roomId` in both `camera.js` and `viewer.js`:
```javascript
this.roomId = 'your-custom-room-name';
```

### Adjust Video Quality
In `camera.js`, modify the video constraints:
```javascript
video: {
    width: { ideal: 1280 },  // Higher resolution
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
}
```

### Add Multiple Users
In `server.js`, extend the users object:
```javascript
const users = {
    admin: 'hashed-password-1',
    viewer: 'hashed-password-2',
    family: 'hashed-password-3'
};
```

## 🔧 Troubleshooting

### Camera Not Starting
- **Check browser permissions** for camera/microphone
- **Try a different browser** (Chrome, Firefox, Safari)
- **Ensure no other apps** are using the camera
- **Check console** for error messages (F12)

### Connection Issues
- **Verify both devices** are connected to internet
- **Check ngrok tunnel** is active and accessible
- **Try refreshing** both camera and viewer pages
- **Check firewall** settings if on corporate network

### Audio Not Working
- **Check microphone permissions** in browser
- **Verify audio** is not muted in browser
- **Test with different device** to isolate issue
- **Check browser audio settings**

### Performance Issues
- **Close unnecessary tabs** and applications
- **Use wired internet** connection when possible
- **Lower video quality** in configuration
- **Check network bandwidth**

## 📂 Project Structure

```
cctv2/
├── server.js              # Main server with WebRTC signaling
├── package.json           # Dependencies and scripts
├── public/
│   ├── camera.html        # Camera interface page
│   ├── viewer.html        # Remote viewing page
│   ├── login.html         # Authentication page
│   ├── css/
│   │   └── style.css      # Styling for all pages
│   └── js/
│       ├── camera.js      # Camera capture logic
│       └── viewer.js      # Remote viewing logic
└── README.md             # This documentation
```

## 🚀 Advanced Setup

### Running as a Service (Linux)

Create a systemd service for automatic startup:

1. **Create service file:**
   ```bash
   sudo nano /etc/systemd/system/home-cctv.service
   ```

2. **Add configuration:**
   ```ini
   [Unit]
   Description=Home CCTV WebRTC Server
   After=network.target

   [Service]
   Type=simple
   User=your-username
   WorkingDirectory=/path/to/cctv2
   ExecStart=/usr/bin/node server.js
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start:**
   ```bash
   sudo systemctl enable home-cctv
   sudo systemctl start home-cctv
   ```

### Docker Setup

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:22.14.0-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run:**
   ```bash
   docker build -t home-cctv .
   docker run -p 3000:3000 home-cctv
   ```

## 📞 Support

### Common Commands

- **Install dependencies:** `npm install`
- **Start server:** `npm start`
- **Development mode:** `npm run dev` (with nodemon)
- **Check logs:** Check browser console (F12)

### Getting Help

If you encounter issues:
1. **Check the browser console** for error messages
2. **Verify all prerequisites** are installed correctly
3. **Test with different browsers** and devices
4. **Check ngrok documentation** for tunneling issues

## 📄 License

MIT License - Feel free to modify and use for personal projects.

---

**⚠️ Security Warning:** This is a basic implementation suitable for personal use. For production deployment, implement additional security measures including proper authentication, HTTPS, rate limiting, and regular security updates.