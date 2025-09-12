# Multi-Camera Testing Guide

## 🧪 How to Test Multi-Camera Feature

### Quick Local Test (Single Device)

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open multiple browser tabs/windows:**
   - Tab 1: `http://localhost:3000/camera` (First camera)
   - Tab 2: `http://localhost:3000/camera` (Second camera)  
   - Tab 3: `http://localhost:3000/viewer` (Viewer)

3. **Set up cameras:**
   - In Tab 1: Name it "Camera 1", device "Browser Tab 1", start camera
   - In Tab 2: Name it "Camera 2", device "Browser Tab 2", start camera
   - Allow camera access when prompted

4. **Test viewer:**
   - In Tab 3: You should see both cameras in the list
   - Click on "Camera 1" to select it
   - Click "Connect to Selected Camera"
   - Disconnect and try "Camera 2"

### Real Multi-Device Test

1. **Device 1 (Home laptop):**
   - Start server: `npm start`
   - Open: `http://localhost:3000/camera`
   - Name: "Living Room Laptop"
   - Start camera

2. **Device 2 (Phone/Tablet):**
   - Connect to same WiFi network
   - Open: `http://[laptop-ip]:3000/camera`
   - Name: "Mobile Camera"
   - Start camera

3. **Remote viewer:**
   - Use ngrok URL: `https://abc123.ngrok.io/viewer`
   - Select between cameras
   - Test switching between them

### With ngrok (Remote Access)

1. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```

2. **Multiple locations:**
   - Home devices connect to: `https://abc123.ngrok.io/camera`
   - Remote viewer uses: `https://abc123.ngrok.io/viewer`

## 🐛 Troubleshooting Multi-Camera

### Camera not appearing in list
- Check camera page shows "Camera active" status
- Refresh the camera list in viewer
- Check browser console for errors
- Ensure camera name is unique

### Connection fails
- Only one viewer per camera at a time
- Try disconnecting and reconnecting
- Check if camera is still active
- Verify network connectivity

### Audio/Video issues
- Check browser permissions for each device
- Try different browsers
- Ensure cameras aren't used by other apps
- Check network bandwidth with multiple streams

## 📱 Recommended Setup

### Home Security System
- **Living Room**: Main laptop/desktop camera
- **Front Door**: Old smartphone with charger
- **Kitchen**: Tablet mounted on wall
- **Bedroom**: Another laptop/phone

### Camera Naming Convention
- Use clear, descriptive names
- Include location: "Front Door Camera"
- Include device type: "Kitchen Tablet"
- Avoid special characters

### Best Practices
- Use wired internet when possible
- Keep devices plugged in (not on battery)
- Position cameras for best viewing angles
- Test all cameras before going remote
- Have backup cameras ready

## 🔧 Performance Notes

- **Single viewer per camera**: Each camera supports one viewer at a time
- **Multiple cameras**: Server can handle many cameras simultaneously  
- **Network bandwidth**: Each stream uses ~1-2 Mbps
- **Device performance**: Older devices may struggle with video encoding

## 🚀 Advanced Usage

### Custom Camera Names
Edit in camera.js if you want preset names:
```javascript
const presetNames = ['Living Room', 'Front Door', 'Kitchen', 'Bedroom'];
```

### Different Rooms/Groups
Modify server.js to support camera groups:
```javascript
// Group cameras by location
const locations = ['Ground Floor', 'First Floor', 'Outdoor'];
```