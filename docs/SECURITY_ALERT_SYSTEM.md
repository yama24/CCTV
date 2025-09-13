# 🚨 Intelligent Security Alert System

## Overview

The CCTV system now includes an advanced security alert system that detects motion and suspicious sounds automatically, sending real-time notifications to all connected viewers with smart spam prevention.

## Features

### 🎯 **Motion Detection**
- **Computer Vision Analysis**: Real-time frame comparison using HTML5 Canvas
- **Configurable Sensitivity**: Adjustable threshold from 0.1 (very sensitive) to 0.8 (less sensitive)
- **Performance Optimized**: Uses 160x120 analysis canvas for efficient processing
- **Movement Intensity**: Reports motion intensity as percentage

### 🔊 **Audio Detection**
- **Web Audio API**: Advanced frequency analysis for suspicious sound detection
- **Volume Threshold**: Configurable sensitivity from 0.3 to 0.9
- **Real-time Processing**: 200ms analysis intervals
- **Noise Filtering**: Built-in audio processing to reduce false positives

### 🚫 **Smart Spam Prevention**
- **Cooldown Periods**: Configurable delay (5-60 seconds) between alerts of same type
- **Alert Aggregation**: Prevents notification flooding during continuous activity
- **Viewer-side Throttling**: Additional 5-second cooldown on viewer notifications
- **Intelligent Suppression**: Different cooldowns for motion vs audio alerts

## How to Use

### 📹 **Camera Side (Stream Provider)**

1. **Start your camera stream** as normal
2. **Enable Security Alerts**: Toggle appears after camera starts
3. **Configure Detection**:
   - ✅ Enable Motion Detection
   - ✅ Enable Audio Detection
   - 🎚️ Adjust sensitivity sliders
   - ⏱️ Set cooldown period
4. **Test the System**: Use test buttons to verify functionality

### 🖥️ **Viewer Side (Monitor)**

1. **Connect to camera** stream as normal
2. **Alert Status**: Green indicator shows when alerts are active
3. **Receive Notifications**:
   - 🚨 Visual popup notifications
   - 🔊 Audio alert sounds (different tones for motion vs sound)
   - 📱 Video border flashing
   - 📊 Status bar updates
4. **Manage Alerts**:
   - 📝 View alert history (last 50 alerts)
   - 🗑️ Clear alert history
   - ⚙️ Adjust camera alert settings remotely

## Alert Types

### 👁️ **Motion Alerts**
```javascript
{
  type: 'motion',
  timestamp: 1694612345678,
  intensity: 0.45,  // 45% motion detected
  message: 'Motion detected - Intensity: 45%',
  cameraName: 'Living Room Camera'
}
```

### 🔊 **Audio Alerts**
```javascript
{
  type: 'audio',
  timestamp: 1694612345678,
  volume: 0.82,     // 82% volume level
  message: 'Suspicious sound detected - Volume: 82%',
  cameraName: 'Front Door Camera'
}
```

## Configuration Options

### Camera Settings
- **Motion Sensitivity**: `0.1` to `0.8` (default: `0.3`)
- **Audio Sensitivity**: `0.3` to `0.9` (default: `0.7`)
- **Alert Cooldown**: `5` to `60` seconds (default: `10`)

### Viewer Settings
- **Alert History Limit**: 50 alerts maximum
- **Notification Duration**: 8 seconds auto-dismiss
- **Audio Alert Sounds**: Enabled by default
- **Visual Indicators**: Flash duration 2 seconds

## Technical Implementation

### Motion Detection Algorithm
```javascript
// Frame difference calculation
const diff = currentFrame - previousFrame;
const normalizedDiff = diff / (pixels * 255);
if (normalizedDiff > threshold) triggerMotionAlert();
```

### Audio Analysis
```javascript
// Web Audio API frequency analysis
analyser.getByteFrequencyData(audioDataArray);
const averageVolume = sum(audioDataArray) / length / 255;
if (averageVolume > threshold) triggerAudioAlert();
```

### Spam Prevention Logic
```javascript
// Cooldown management
const alertKey = `${alertType}_${roomId}`;
const timeSinceLastAlert = now - lastAlertTime[alertKey];
if (timeSinceLastAlert < cooldownPeriod) {
  suppressAlert();
  return;
}
```

## Server-Side Architecture

### Alert Broadcasting
```javascript
// Server broadcasts to all viewers in room
room.viewers.forEach(viewerId => {
  viewerSocket.emit('security-alert-received', alertData);
});
```

### Alert Logging
```javascript
// Comprehensive logging for security analysis
console.log(`🚨 SECURITY LOG [${timestamp}] ${cameraName}: ${message}`);
```

## Browser Compatibility

### Supported Features
- ✅ **Motion Detection**: All modern browsers with Canvas support
- ✅ **Audio Detection**: Browsers with Web Audio API support
- ✅ **Notifications**: All browsers with DOM manipulation
- ✅ **Real-time Alerts**: WebSocket-supported browsers

### Requirements
- **Camera Device**: WebRTC getUserMedia support
- **Canvas API**: For motion detection frame analysis
- **Web Audio API**: For audio frequency analysis
- **WebSocket**: For real-time alert delivery

## Performance Optimization

### Motion Detection
- **Reduced Resolution**: 160x120 analysis vs full video resolution
- **Grayscale Processing**: Single channel instead of RGB
- **Efficient Intervals**: 500ms analysis frequency
- **Memory Management**: Canvas reuse and cleanup

### Audio Analysis
- **FFT Size**: 256 bins for balanced performance/accuracy
- **Analysis Frequency**: 200ms intervals
- **Buffer Management**: Uint8Array reuse

### Network Efficiency
- **Event Batching**: Prevents excessive socket emissions
- **Compression**: Minimal alert payload size
- **Local Processing**: Client-side analysis reduces server load

## Security Considerations

### Privacy Protection
- **Local Processing**: All analysis done client-side
- **No Recording**: No video/audio data stored on server
- **Temporary Logs**: Alert logs for debugging only
- **User Control**: Full user control over sensitivity and activation

### Performance Impact
- **Low CPU Usage**: Optimized algorithms for continuous operation
- **Minimal Memory**: Small canvas buffers and efficient cleanup
- **Background Operation**: Works with existing background streaming
- **Battery Conscious**: Reduced processing when not needed

## Testing and Validation

### Motion Detection Tests
```javascript
// Test motion sensitivity
camera.testMotionDetection(); // Simulates 50% motion
```

### Audio Detection Tests
```javascript
// Test audio sensitivity
camera.testAudioDetection(); // Simulates 80% volume
```

### Integration Tests
- ✅ Multi-viewer alert delivery
- ✅ Cross-device notification sync
- ✅ Spam prevention validation
- ✅ Background mode compatibility

## Troubleshooting

### Motion Detection Issues
- **No alerts**: Check camera permissions and video stream
- **Too sensitive**: Increase motion sensitivity value (0.1 → 0.5)
- **Not sensitive enough**: Decrease motion sensitivity value (0.5 → 0.2)

### Audio Detection Issues
- **No alerts**: Check microphone permissions and audio stream
- **False positives**: Increase audio sensitivity value (0.5 → 0.8)
- **Missing alerts**: Decrease audio sensitivity value (0.8 → 0.4)

### Notification Issues
- **No sound**: Check browser audio permissions
- **Spam notifications**: Increase cooldown period (10s → 30s)
- **Missing alerts**: Check WebSocket connection status

## Future Enhancements

### Planned Features
- 🎯 **Object Detection**: Specific object recognition (person, vehicle, etc.)
- 📊 **Pattern Analysis**: Learning user patterns to reduce false positives
- 🌐 **Cloud Integration**: Optional cloud-based analysis
- 📱 **Mobile Push**: Native mobile app notifications
- 🔔 **Email Alerts**: Email notification system
- 📈 **Analytics Dashboard**: Security event statistics and trends

### Advanced Configurations
- **Zone-based Detection**: Define specific areas for motion detection
- **Schedule-based Alerts**: Time-based activation/deactivation
- **Custom Thresholds**: Different sensitivity for day/night
- **Multiple Camera Correlation**: Cross-camera event correlation

## API Reference

### Camera Methods
```javascript
// Enable/disable alerts
camera.enableSecurityAlerts()
camera.disableSecurityAlerts()

// Update settings
camera.updateAlertSettings({
  motionEnabled: true,
  audioEnabled: true,
  motionSensitivity: 0.3,
  audioSensitivity: 0.7,
  cooldownSeconds: 10
})

// Test functions
camera.testMotionDetection()
camera.testAudioDetection()
```

### Viewer Methods
```javascript
// Alert management
viewer.clearAlertHistory()
viewer.showAlertHistory()
viewer.updateCameraAlertSettings(settings)

// Event handlers
viewer.handleSecurityAlert(alertData)
viewer.updateSecurityAlertsStatus(statusData)
```

This intelligent security alert system transforms your CCTV setup into a proactive security monitoring solution with minimal performance impact and maximum user control.