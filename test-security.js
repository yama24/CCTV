#!/usr/bin/env node

// Test script to verify authentication is required for all endpoints
const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(path, method = 'GET', headers = {}) {
    return new Promise((resolve) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                error: err.message,
                statusCode: 0
            });
        });

        req.end();
    });
}

async function runSecurityTests() {
    console.log('🔒 Testing CCTV Security Implementation...\n');

    const tests = [
        {
            name: 'Unauthenticated access to /camera',
            path: '/camera',
            expectedStatus: 302, // Should redirect to login
            expectRedirect: true
        },
        {
            name: 'Unauthenticated access to /viewer', 
            path: '/viewer',
            expectedStatus: 302, // Should redirect to login
            expectRedirect: true
        },
        {
            name: 'Unauthenticated access to /api/cameras',
            path: '/api/cameras',
            expectedStatus: 401, // Should return unauthorized
            expectJson: true
        },
        {
            name: 'Unauthenticated access to /api/auth/token',
            path: '/api/auth/token', 
            expectedStatus: 302, // Should redirect to login
            expectRedirect: true
        },
        {
            name: 'Unauthenticated access to /js/camera.js',
            path: '/js/camera.js',
            expectedStatus: 302, // Should redirect to login  
            expectRedirect: true
        },
        {
            name: 'Unauthenticated access to /js/viewer.js',
            path: '/js/viewer.js',
            expectedStatus: 302, // Should redirect to login
            expectRedirect: true
        },
        {
            name: 'Unauthenticated access to /css/style.css',
            path: '/css/style.css', 
            expectedStatus: 302, // Should redirect to login
            expectRedirect: true
        },
        {
            name: 'Access to login page (should work)',
            path: '/login',
            expectedStatus: 200, // Should work without authentication
            expectHtml: true
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await testEndpoint(test.path);
            
            let success = false;
            let message = '';

            if (result.error) {
                message = `❌ Connection error: ${result.error}`;
            } else if (result.statusCode === test.expectedStatus) {
                if (test.expectRedirect && result.headers.location) {
                    success = result.headers.location.includes('/login');
                    message = success ? 
                        `✅ Correctly redirects to login (${result.statusCode})` :
                        `❌ Redirects to wrong location: ${result.headers.location}`;
                } else if (test.expectJson) {
                    try {
                        const jsonBody = JSON.parse(result.body);
                        success = jsonBody.error && jsonBody.error.toLowerCase().includes('token');
                        message = success ?
                            `✅ Correctly returns auth error: ${jsonBody.error}` :
                            `❌ Unexpected JSON response: ${result.body}`;
                    } catch (e) {
                        message = `❌ Invalid JSON response: ${result.body}`;
                    }
                } else if (test.expectHtml) {
                    success = result.body.includes('login') || result.body.includes('Login');
                    message = success ?
                        `✅ Login page accessible (${result.statusCode})` :
                        `❌ Unexpected content on login page`;
                } else {
                    success = true;
                    message = `✅ Status ${result.statusCode} as expected`;
                }
            } else {
                message = `❌ Expected status ${test.expectedStatus}, got ${result.statusCode}`;
            }

            console.log(`${test.name}:`);
            console.log(`  ${message}`);
            
            if (success) {
                passed++;
            } else {
                failed++;
            }
            
        } catch (error) {
            console.log(`${test.name}:`);
            console.log(`  ❌ Test failed: ${error.message}`);
            failed++;
        }
        
        console.log('');
    }

    console.log(`\n📊 Security Test Results:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    if (failed === 0) {
        console.log('\n🎉 All security tests passed! The system is properly secured.');
    } else {
        console.log('\n⚠️  Some security tests failed. Please review the implementation.');
    }
}

// Run tests if server is available
setTimeout(runSecurityTests, 1000); // Give server time to start