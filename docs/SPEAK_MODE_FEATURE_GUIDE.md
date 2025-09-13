# Speak Mode Feature Guide

## Overview 🎤

The speak mode feature allows viewers to communicate with camera devices using voice communication. This creates a two-way communication system where viewers can speak to people at the camera location.

## Features Implemented ✅

### 1. **Viewer-Side (viewer.html/js)**
- **Speak Mode Toggle**: Start/Stop speaking buttons with visual indicators
- **Microphone Access**: Automatic microphone permission request and access
- **Real-time Audio Streaming**: Audio captured from viewer's microphone and streamed to camera
- **Connection Status**: Visual feedback showing speak mode status (Ready, Connecting, Speaking)
- **Error Handling**: User-friendly error messages for microphone access issues

### 2. **Camera-Side (camera.js)**
- **Audio Reception**: Receives and plays audio from viewers in real-time
- **Multi-Viewer Support**: Can receive audio from multiple viewers simultaneously  
- **Visual Indicators**: Shows when viewers are speaking with animated indicators
- **Audio Playback**: Automatic audio playback through device speakers/headphones
- **Connection Management**: Handles speak mode connections separately from video streaming

### 3. **Server-Side (server.js)**
- **WebSocket Handling**: Complete WebSocket event handling for speak mode
- **Security**: Authentication and access control for speak mode features
- **Message Routing**: Proper routing of offers, answers, and ICE candidates between viewer and camera
- **Error Handling**: Comprehensive error handling and user feedback

## How It Works 🔧

### Connection Flow:
1. **Viewer connects to camera** (standard video viewing)
2. **Viewer clicks "Start Speaking"** → Requests microphone access
3. **WebRTC offer created** → Viewer sends speak-offer to camera via server
4. **Camera accepts** → Creates answer and sends back to viewer
5. **ICE candidates exchanged** → Direct peer-to-peer connection established
6. **Audio streaming begins** → Real-time audio from viewer to camera
7. **Visual feedback** → Both sides show speaking indicators

### Technical Implementation:
- **Separate WebRTC connection** for audio (independent of video stream)
- **WebSocket signaling** for connection setup and management
- **STUN servers** for NAT traversal
- **Audio constraints** with echo cancellation and noise suppression
- **Auto-cleanup** when connections are lost or camera stops

## User Interface 🎨

### Viewer Controls:
```
🎤 Speak to Camera
Ready                           [Status Indicator]

[🎙️ Start Speaking]  [⏹️ Stop Speaking]

💡 Click "Start Speaking" to communicate with the camera. 
Your microphone will be activated and audio will be 
streamed to the camera device.
```

### Camera Indicators:
- **Floating indicator** appears when viewers are speaking
- **Status updates** in main camera status
- **Automatic cleanup** when speak sessions end

## Security & Privacy 🔒

- **Authentication required** for all speak mode operations
- **Access control** - Only camera owners can receive speech from their viewers
- **Permission-based** - Viewers must explicitly grant microphone access
- **User control** - Both sides can start/stop speak mode at any time
- **No recording** - Audio is streamed live, not stored

## Error Handling 🛠️

### Common Issues Handled:
- **Microphone access denied** → Clear user instruction to allow permissions
- **No microphone found** → Prompt to connect microphone device
- **Connection failed** → Automatic retry and fallback options
- **Network issues** → Graceful degradation and cleanup

## Usage Instructions 📝

### For Viewers:
1. **Connect to a camera** from the viewer page
2. **Look for speak controls** in the viewing interface (appears after connecting)
3. **Click "Start Speaking"** and allow microphone access when prompted
4. **Speak normally** - your voice will be transmitted to the camera device
5. **Click "Stop Speaking"** when finished

### For Camera Users:
1. **Start your camera** from the camera page
2. **Wait for viewers** to connect normally
3. **Watch for speak indicator** when viewers start speaking
4. **Listen through your device speakers** for viewer audio
5. **Speak normally** - your voice is captured by your camera's microphone

## Browser Compatibility 🌐

### Supported Browsers:
- ✅ **Chrome/Chromium** (Desktop & Mobile)
- ✅ **Firefox** (Desktop & Mobile)  
- ✅ **Safari** (Desktop & Mobile)
- ✅ **Edge** (Desktop)

### Requirements:
- **HTTPS connection** (required for microphone access)
- **WebRTC support** (available in all modern browsers)
- **Microphone access** (must be granted by user)

## Testing the Feature 🧪

### Test Steps:
1. **Start the CCTV server** (`npm start`)
2. **Open camera page** in one browser/device
3. **Start a camera** with a recognizable name
4. **Open viewer page** in another browser/device  
5. **Connect to the camera** from viewer
6. **Test speak mode**:
   - Click "Start Speaking" on viewer
   - Allow microphone access
   - Speak into viewer's microphone
   - Listen for audio on camera device
   - Test "Stop Speaking" functionality

### Expected Behavior:
- ✅ Speak controls appear when connected to camera
- ✅ Microphone permission requested when starting speak mode
- ✅ Audio transmitted from viewer to camera in real-time
- ✅ Visual indicators show speaking status on both sides
- ✅ Clean disconnect when stopping speak mode

## Code Structure 📂

```
public/
├── viewer.html          # Updated with speak controls UI
├── css/style.css        # Added speak mode styling
└── js/
    ├── viewer.js        # Added speak mode client functionality
    └── camera.js        # Added speak mode audio reception

server.js                # Added WebSocket handlers for speak mode
```

## Future Enhancements 🚀

Possible improvements for the speak mode feature:

- **Volume controls** for received audio
- **Push-to-talk mode** as alternative to toggle mode
- **Audio recording** option (with proper permissions)
- **Multiple audio streams** mixing for multiple viewers
- **Audio quality settings** (bitrate, codec selection)
- **Mute/unmute** controls for camera side

## Troubleshooting 🔧

### Common Issues:

**Q: Speak button doesn't appear**
A: Make sure you're connected to a camera first. Speak controls only show when viewing a camera.

**Q: Microphone access denied**
A: Check browser permissions, ensure HTTPS, and manually allow microphone access in browser settings.

**Q: No audio at camera**
A: Check camera device speakers/headphones, ensure audio output is not muted.

**Q: Connection fails**
A: Check network connectivity, try refreshing both camera and viewer pages.

**Q: Speak mode stuck "Connecting"**
A: Stop speak mode and try again. Check browser console for WebRTC errors.

## Development Notes 💻

- **Separate WebRTC connections** used for video and audio to avoid conflicts
- **Proper cleanup** implemented to prevent memory leaks
- **Error boundaries** added for graceful failure handling  
- **Visual feedback** ensures users understand connection status
- **Security model** maintains existing authentication system