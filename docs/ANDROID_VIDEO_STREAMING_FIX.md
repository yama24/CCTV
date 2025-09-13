# Android Chrome Video Streaming Background Fix

## Problem Description

When running camera streaming on Android Chrome and minimizing the browser, the following occurs:
- **Audio stream continues normally** - Audio processing continues in the background
- **Video stream freezes** - Video rendering is suspended by Chrome's mobile optimizations
- **WebRTC connection stays active** - The peer connection remains connected
- **Viewers see frozen video** - Remote viewers see the last video frame with live audio

## Root Cause

Mobile Chrome aggressively suspends video processing when the browser is minimized to save battery and CPU. This includes:

1. **Video Track Suspension**: Video tracks remain "live" but frame processing stops
2. **Canvas Rendering Halt**: Canvas drawing operations are suspended
3. **RequestAnimationFrame Pause**: Animation loops are paused
4. **GPU Context Suspension**: Graphics processing is minimized

## Enhanced Solution: Video-Specific Background Streaming

### 1. Hidden Video Element Processing
```javascript
// Create hidden video element that continuously processes the stream
this.keepaliveVideo = document.createElement('video');
this.keepaliveVideo.srcObject = this.localStream;
```

**Purpose**: Keep video decoding active even when main video is suspended

### 2. Continuous Frame Rendering
```javascript
const renderFrame = () => {
    if (this.keepaliveVideo && !this.keepaliveVideo.paused) {
        videoCtx.drawImage(this.keepaliveVideo, 0, 0, 64, 48);
    }
    if (this.isBackgroundMode) {
        requestAnimationFrame(renderFrame);
    }
};
```

**Purpose**: Force continuous video frame processing through canvas drawing

### 3. Video Track Forcing
```javascript
// Force track constraints refresh every 5 seconds
track.applyConstraints({
    width: currentSettings.width,
    height: currentSettings.height,
    frameRate: currentSettings.frameRate
});
```

**Purpose**: Prevent video track from going dormant

### 4. Enhanced Track Monitoring
```javascript
// Monitor video time updates to detect freezing
if (this.lastVideoTime === currentTime && currentTime > 0) {
    this.videoStallCount++;
    if (this.videoStallCount > 3) {
        needsRecovery = true;
    }
}
```

**Purpose**: Detect when video stream has actually frozen

### 5. Aggressive Track Refreshing
```javascript
// Temporarily disable/enable track to force refresh
if (track.enabled) {
    track.enabled = false;
    setTimeout(() => track.enabled = true, 10);
}
```

**Purpose**: Force video track to stay active during background mode

## Implementation Layers

### Layer 1: Wake Lock API
- Prevents device sleep
- Keeps screen API active

### Layer 2: Background Canvas
- Maintains GPU context
- Prevents graphics suspension

### Layer 3: **Video Keepalive Canvas (NEW)**
- **Hidden video element processing**
- **Continuous frame rendering**
- **Video-specific GPU activity**

### Layer 4: Stream Touching
- Enhanced with video track forcing
- Track enable/disable cycling
- Constraints reapplication

### Layer 5: Page Suspension Prevention
- Enhanced with video track maintenance
- Aggressive constraint refreshing
- Video-specific intervals

### Layer 6: **Video Frame Monitoring (NEW)**
- **Video time tracking**
- **Frame rate monitoring**
- **Freeze detection and recovery**

## Video-Specific Optimizations

### Mobile Chrome Video Handling
```javascript
// Mobile-specific video constraints forcing
if (this.deviceInfo?.isMobile && this.isBackgroundMode) {
    // Video track enable/disable cycling
    // Constraint reapplication
    // Frame rate monitoring
}
```

### Video Stream Recovery
```javascript
// Detect video freezing through multiple methods:
// 1. Video element currentTime tracking
// 2. Track settings frameRate monitoring  
// 3. Canvas rendering success monitoring
// 4. WebRTC stats analysis
```

## Testing the Fix

### Verification Steps
1. Start camera from Android Chrome
2. Connect viewer from another device
3. **Minimize Chrome on Android** - This is the critical test
4. **Verify audio continues** - Should hear live audio
5. **Verify video continues** - Should see live video (not frozen)
6. Check console logs for background mode activation
7. Monitor for freeze detection and recovery

### Expected Behavior
- ✅ Audio stream remains active (was already working)
- ✅ **Video stream continues** (NEW - this was freezing before)
- ✅ Background mode indicators appear
- ✅ Automatic freeze detection and recovery
- ✅ Continuous video frame processing

### Debug Monitoring
```javascript
console.log('📱 Video keepalive system created');
console.log('📱 Video keepalive canvas started rendering');
console.warn('Video stream appears frozen (no time updates)');
console.log('🔄 Background mode: Stream recovery needed');
```

## Performance Impact

### Resource Usage
- **Minimal CPU**: 64x48 canvas rendering vs full resolution
- **Low Memory**: Single hidden video element
- **Battery Efficient**: Only active during background mode
- **Network Neutral**: No additional bandwidth usage

### Cleanup
All video keepalive elements are automatically cleaned up when:
- Camera stops streaming
- Background mode is disabled
- Page is closed/refreshed

## Browser Compatibility

### Supported
- ✅ Android Chrome (primary target)
- ✅ Android Firefox
- ✅ iOS Safari (limited background support)
- ✅ Desktop browsers (fallback behavior)

### Limitations
- iOS has stricter background limitations
- Some Android variants may have additional restrictions
- Requires modern browser with Canvas and RequestAnimationFrame support

## Troubleshooting

### Video Still Freezes
1. Check console for video keepalive creation logs
2. Verify hidden video element is created
3. Check if canvas rendering is active
4. Monitor video time updates

### High Battery Usage
1. Reduce canvas rendering frequency
2. Use smaller keepalive canvas size
3. Check if multiple background modes are active

### Audio Works But Video Doesn't
1. This indicates the fix is working partially
2. Check video track constraints
3. Monitor frame rate in track settings
4. Verify canvas drawing operations