# PC Camera Switching Test

## What Was Fixed

The PC camera switching now uses a dedicated 5-level fallback system that tries different constraint combinations specifically for desktop devices.

## How to Test

1. **Access Camera Page**: Go to `http://localhost:3000/camera` on your PC
2. **Start Camera**: Select a camera and start streaming
3. **Open Viewer**: In another tab/device, go to `http://localhost:3000/viewer` and connect
4. **Switch Cameras**: Use the device switching controls in the viewer to change PC cameras

## Expected Console Messages

When switching cameras on PC, you should see:

```
Switching video device to: [device-id]
Target device found: [device-label]
Using PC camera fallback approach
PC camera fallback for device: [device-id]
PC fallback attempt 1: {video: {deviceId: {exact: "..."}, width: {ideal: 640}...}}
PC fallback attempt 1 success. Device: [actual-device-id]
New video track obtained: {...}
Device switch completed
```

## Fallback Levels

If one method fails, it automatically tries the next:

1. **Exact deviceId + basic constraints** (640x480)
2. **Exact deviceId only**
3. **Ideal deviceId + basic constraints** 
4. **Ideal deviceId only**
5. **Default camera** (as last resort)

## Key Differences from Mobile

- **Mobile**: Uses existing gentle constraints and mobile-optimized approach
- **PC**: Uses 5-level progressive fallback with different constraint combinations

This should resolve PC camera switching while keeping mobile functionality exactly as it was.

## If Still Not Working

Check browser console for specific error messages and share them for further debugging.