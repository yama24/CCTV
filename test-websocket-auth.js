#!/usr/bin/env node

// Test WebSocket authentication
const { io } = require('socket.io-client');

console.log('🔌 Testing WebSocket Authentication...\n');

// Declare sockets in outer scope so they can be accessed in cleanup
let socket1, socket2, socket3;

// Test 1: Connection without authentication token
console.log('Test 1: Connecting without authentication token...');
socket1 = io('http://localhost:3000');

socket1.on('connect', () => {
    console.log('❌ SECURITY ISSUE: Connected without authentication!');
    socket1.disconnect();
});

socket1.on('connect_error', (error) => {
    if (error.message.includes('Authentication')) {
        console.log('✅ Correctly rejected unauthenticated connection');
        console.log(`   Error: ${error.message}`);
    } else {
        console.log(`❌ Unexpected error: ${error.message}`);
    }
});

// Test 2: Connection with invalid token
setTimeout(() => {
    console.log('\nTest 2: Connecting with invalid token...');
    socket2 = io('http://localhost:3000', {
        auth: {
            token: 'invalid-token-123'
        }
    });

    socket2.on('connect', () => {
        console.log('❌ SECURITY ISSUE: Connected with invalid token!');
        socket2.disconnect();
    });

    socket2.on('connect_error', (error) => {
        if (error.message.includes('Authentication') || error.message.includes('Invalid')) {
            console.log('✅ Correctly rejected invalid token');
            console.log(`   Error: ${error.message}`);
        } else {
            console.log(`❌ Unexpected error: ${error.message}`);
        }
    });
}, 1000);

// Test 3: Connection with expired token
setTimeout(() => {
    console.log('\nTest 3: Connecting with expired token...');
    
    // Create an expired JWT token (using a known secret for testing)
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
        { username: 'test', authenticated: true },
        'your-jwt-secret-key-change-in-production', // Using the same secret as server
        { expiresIn: '-1h' } // Expired 1 hour ago
    );
    
    socket3 = io('http://localhost:3000', {
        auth: {
            token: expiredToken
        }
    });

    socket3.on('connect', () => {
        console.log('❌ SECURITY ISSUE: Connected with expired token!');
        socket3.disconnect();
    });

    socket3.on('connect_error', (error) => {
        if (error.message.includes('Authentication') || error.message.includes('expired')) {
            console.log('✅ Correctly rejected expired token');
            console.log(`   Error: ${error.message}`);
        } else {
            console.log(`❌ Unexpected error: ${error.message}`);
        }
    });

    // Close all sockets after tests
    setTimeout(() => {
        if (socket1) socket1.disconnect();
        if (socket2) socket2.disconnect(); 
        if (socket3) socket3.disconnect();
        console.log('\n🔒 WebSocket authentication tests completed.');
        process.exit(0);
    }, 2000);
}, 2000);