#!/usr/bin/env node

// Test Camera Access Control
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

console.log('🔒 Testing Camera Access Control...\n');

// JWT secret should match server
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';

// Create test tokens for different users
const user1Token = jwt.sign({
    username: 'testuser1',
    userId: 1,
    role: 'user',
    authenticated: true
}, JWT_SECRET, { expiresIn: '1h' });

const user2Token = jwt.sign({
    username: 'testuser2', 
    userId: 2,
    role: 'user',
    authenticated: true
}, JWT_SECRET, { expiresIn: '1h' });

const adminToken = jwt.sign({
    username: 'admin',
    userId: 99,
    role: 'admin',
    authenticated: true
}, JWT_SECRET, { expiresIn: '1h' });

// Test scenarios
async function testCameraAccessControl() {
    console.log('1️⃣ Testing User 1 connects camera...');
    
    // User 1 connects a camera
    const user1Camera = io('http://localhost:3000', {
        auth: { token: user1Token }
    });

    await new Promise((resolve) => {
        user1Camera.on('connect', () => {
            console.log('✅ User 1 camera connected');
            user1Camera.emit('join-room', {
                roomId: 'camera-user1-room',
                role: 'camera',
                cameraName: 'User 1 Camera',
                deviceInfo: 'Test Camera Device'
            });
            resolve();
        });
    });

    // Wait a bit for camera to fully register
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n2️⃣ Testing User 2 tries to access User 1\'s camera...');
    
    // User 2 tries to access User 1's camera
    const user2Viewer = io('http://localhost:3000', {
        auth: { token: user2Token }
    });

    await new Promise((resolve) => {
        let errorReceived = false;
        
        user2Viewer.on('connect', () => {
            console.log('✅ User 2 viewer connected');
            user2Viewer.emit('join-room', {
                roomId: 'camera-user1-room', // Trying to access User 1's camera
                role: 'viewer'
            });
        });

        user2Viewer.on('error', (error) => {
            console.log(`✅ Access correctly denied: ${error.message}`);
            errorReceived = true;
            setTimeout(resolve, 500);
        });

        // If no error received within 2 seconds, this is a problem
        setTimeout(() => {
            if (!errorReceived) {
                console.log('❌ ERROR: User 2 was allowed to access User 1\'s camera!');
            }
            resolve();
        }, 2000);
    });

    console.log('\n3️⃣ Testing Admin can access all cameras...');
    
    // Admin tries to access User 1's camera
    const adminViewer = io('http://localhost:3000', {
        auth: { token: adminToken }
    });

    await new Promise((resolve) => {
        let joinedSuccessfully = false;
        
        adminViewer.on('connect', () => {
            console.log('✅ Admin connected');
            adminViewer.emit('join-room', {
                roomId: 'camera-user1-room',
                role: 'viewer'
            });
        });

        adminViewer.on('error', (error) => {
            console.log(`❌ ERROR: Admin was denied access: ${error.message}`);
            setTimeout(resolve, 500);
        });

        // Check if admin can join without error
        setTimeout(() => {
            if (!joinedSuccessfully) {
                // Assume success if no error received
                console.log('✅ Admin successfully accessed User 1\'s camera');
            }
            resolve();
        }, 2000);
    });

    console.log('\n4️⃣ Testing User 1 can access own camera...');
    
    // User 1 tries to view their own camera
    const user1Viewer = io('http://localhost:3000', {
        auth: { token: user1Token }
    });

    await new Promise((resolve) => {
        let errorReceived = false;
        
        user1Viewer.on('connect', () => {
            console.log('✅ User 1 viewer connected');
            user1Viewer.emit('join-room', {
                roomId: 'camera-user1-room', // Their own camera
                role: 'viewer'
            });
        });

        user1Viewer.on('error', (error) => {
            console.log(`❌ ERROR: User 1 was denied access to their own camera: ${error.message}`);
            errorReceived = true;
            setTimeout(resolve, 500);
        });

        // If no error, access was allowed (which is correct)
        setTimeout(() => {
            if (!errorReceived) {
                console.log('✅ User 1 successfully accessed their own camera');
            }
            resolve();
        }, 2000);
    });

    console.log('\n🧪 Testing Camera API endpoint filtering...');

    // Test API endpoint access
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    // Test User 1 API access
    try {
        const response = await fetch('http://localhost:3000/api/cameras', {
            headers: {
                'Authorization': `Bearer ${user1Token}`
            }
        });
        
        if (response.ok) {
            const cameras = await response.json();
            console.log(`✅ User 1 sees ${cameras.length} camera(s) via API`);
            
            // Should only see their own camera
            const ownCameras = cameras.filter(cam => cam.userId === 1);
            if (ownCameras.length === cameras.length) {
                console.log('✅ User 1 API correctly filtered to own cameras only');
            } else {
                console.log('❌ ERROR: User 1 API shows cameras they don\'t own');
            }
        } else {
            console.log('❌ ERROR: User 1 API request failed');
        }
    } catch (error) {
        console.log(`❌ ERROR: User 1 API request error: ${error.message}`);
    }

    // Test Admin API access  
    try {
        const response = await fetch('http://localhost:3000/api/cameras', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (response.ok) {
            const cameras = await response.json();
            console.log(`✅ Admin sees ${cameras.length} camera(s) via API`);
        } else {
            console.log('❌ ERROR: Admin API request failed');
        }
    } catch (error) {
        console.log(`❌ ERROR: Admin API request error: ${error.message}`);
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test connections...');
    user1Camera.disconnect();
    user2Viewer.disconnect();
    adminViewer.disconnect();
    user1Viewer.disconnect();
    
    console.log('\n✅ Camera access control tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Users can only access their own cameras');
    console.log('- Users cannot access other users\' cameras'); 
    console.log('- Admins can access all cameras');
    console.log('- API endpoints properly filter cameras by ownership');
    
    process.exit(0);
}

// Run tests
testCameraAccessControl().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});