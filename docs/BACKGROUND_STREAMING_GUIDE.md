# Background Streaming for Android Devices

## Problem Solved ✅

**Issue**: When minimizing browser on Android device, camera stream pauses and viewers lose connection.

**Solution**: Implemented comprehensive background streaming support that keeps camera active when browser is minimized.

## Key Features Implemented

### 🔄 **Automatic Background Mode Detection**
- Detects when Android browser is minimized or loses focus
- Automatically enables background streaming mode
- Shows status indicators to both camera and viewers

### 📡 **Keep-Alive Mechanism**  
- Sends periodic signals every 5 seconds to maintain connection
- Monitors stream health and attempts recovery if needed
- Prevents mobile browser from sleeping the camera stream

### 🛡️ **Stream Health Monitoring**
- Continuously checks if video/audio tracks are still live
- Automatic stream recovery if tracks become inactive
- Graceful fallback to maintain viewer connections

### 📱 **Mobile-Specific Optimizations**
- Wake Lock API to prevent device from sleeping (when supported)
- Invisible keep-alive video element for older browsers
- Page visibility and app state change detection

## How It Works

### When Camera Goes to Background:
1. **Detection**: Page visibility API detects browser minimization
2. **Activation**: Background mode automatically enables
3. **Keep-Alive**: Periodic signals sent to maintain connection
4. **Monitoring**: Stream health checked every 5 seconds
5. **Recovery**: Automatic stream restart if connection degrades

### Status Indicators:
- **Camera Device**: Shows "📱 Running in background - Camera active"
- **Viewer Device**: Shows "📱 Camera in Background Mode - Stream continues"
- **Keep-Alive Signals**: Shows last activity timestamp

## Testing Instructions

### Test Scenario 1: Basic Background Streaming
1. **Setup Android Camera**:
   - Open `http://[IP]:3000/camera` on Android Chrome
   - Start camera stream
   - Note the camera name

2. **Setup Viewer**:
   - Open `http://[IP]:3000/viewer` on PC or another device
   - Connect to the Android camera

3. **Test Background Mode**:
   - Minimize browser on Android (press home button)
   - Check viewer - stream should continue
   - Look for "📱 Camera in Background Mode" indicator

4. **Return to Foreground**:
   - Return to Android browser
   - Background mode should automatically disable
   - Stream continues normally

### Test Scenario 2: Extended Background Operation
1. Start camera on Android as above
2. Connect viewer
3. Minimize Android browser for several minutes
4. Check viewer for keep-alive signals (every 5 seconds)
5. Stream should remain stable throughout

### Test Scenario 3: Stream Recovery
1. Start camera and viewer as above
2. Minimize Android browser
3. Wait for automatic stream health checks
4. If stream degrades, automatic recovery should occur
5. Viewer should show brief recovery message

## Console Messages to Monitor

### On Camera (Android) Device:
```
Page hidden, enabling background streaming mode...
🔄 Enabling background streaming mode...
Starting background keep-alive mechanism...
📡 Background keep-alive signal sent
✅ Stream health check passed
```

### On Viewer Device:
```
Camera background status: {backgroundMode: true, message: "Camera running in background"}
📡 Last signal: [timestamp]
```

### Server Logs:
```
📡 Keep-alive from camera [roomId] (background: true)
Camera [roomId] entered background mode
```

## What Happens in Background Mode

### ✅ **Maintained Functions:**
- Camera stream continues running
- WebRTC connections stay active  
- Viewers can still watch the stream
- Device switching still works remotely
- Audio continues streaming

### 🔧 **Optimizations Applied:**
- Reduced video element updates (opacity 0.5)
- Keep-alive signals every 5 seconds
- Stream health monitoring
- Wake lock to prevent device sleep
- Graceful recovery mechanisms

### 📊 **Visual Indicators:**
- Orange "Background Mode" badge on viewer
- Green keep-alive timestamp indicator
- Status messages on both camera and viewer

## Troubleshooting

### If Background Mode Doesn't Activate:
- Check browser console for visibility API support
- Ensure Android Chrome is recent version
- Try different minimize methods (home button vs recent apps)

### If Stream Still Pauses:
- Check for "Wake lock acquired" message in console
- Some Android devices may have aggressive power management
- Try enabling "Don't optimize" for Chrome in battery settings

### If Keep-Alive Fails:
- Check network connection stability
- Verify server is receiving keep-alive signals
- Stream recovery should attempt automatic restart

## Success Indicators

The background streaming is working correctly when:
- ✅ Android camera shows "Running in background" when minimized  
- ✅ Viewer shows "Camera in Background Mode" indicator
- ✅ Keep-alive signals appear every 5 seconds
- ✅ Stream continues without interruption
- ✅ Automatic return to normal mode when restoring Android browser

This implementation ensures your Android camera device can stream continuously even when the browser is minimized, providing a true background streaming solution!