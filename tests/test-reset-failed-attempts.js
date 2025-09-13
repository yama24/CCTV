#!/usr/bin/env node

// Test script for reset failed login attempts functionality
const Database = require('../database');

async function testResetFunctionality() {
    console.log('🧪 Testing Reset Failed Login Attempts Functionality\n');

    const db = new Database();

    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        console.log('1️⃣ Creating test failed login attempts...');

        // Create some test failed login attempts
        const testAttempts = [
            { username: 'testuser', success: false, errorMessage: 'Invalid password' },
            { username: 'testuser', success: false, errorMessage: 'Invalid password' },
            { username: 'testuser', success: false, errorMessage: 'Invalid password' },
            { username: 'admin', success: false, errorMessage: 'Invalid password' },
            { username: 'admin', success: true, errorMessage: null }
        ];

        for (const attempt of testAttempts) {
            await new Promise((resolve, reject) => {
                db.logLoginAttempt({
                    username: attempt.username,
                    ipAddress: '127.0.0.1',
                    userAgent: 'Test Agent',
                    success: attempt.success,
                    errorMessage: attempt.errorMessage
                }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        console.log('✅ Created test login attempts');

        console.log('\n2️⃣ Checking failed attempts count for testuser...');
        
        // Check failed attempts count
        const failedCount = await new Promise((resolve, reject) => {
            db.getFailedLoginAttemptsCount('testuser', 24 * 60, (err, count) => {
                if (err) reject(err);
                else resolve(count);
            });
        });

        console.log(`📊 testuser has ${failedCount} failed attempts`);

        console.log('\n3️⃣ Resetting failed attempts for testuser...');

        // Reset failed attempts
        const resetResult = await new Promise((resolve, reject) => {
            db.resetFailedLoginAttempts('testuser', (err, changes) => {
                if (err) reject(err);
                else resolve(changes);
            });
        });

        console.log(`✅ Reset ${resetResult} failed attempts for testuser`);

        console.log('\n4️⃣ Checking failed attempts count after reset...');

        // Check failed attempts count after reset
        const failedCountAfter = await new Promise((resolve, reject) => {
            db.getFailedLoginAttemptsCount('testuser', 24 * 60, (err, count) => {
                if (err) reject(err);
                else resolve(count);
            });
        });

        console.log(`📊 testuser now has ${failedCountAfter} failed attempts`);

        console.log('\n5️⃣ Checking that admin failed attempts are not affected...');

        // Check admin failed attempts (should still exist)
        const adminFailedCount = await new Promise((resolve, reject) => {
            db.getFailedLoginAttemptsCount('admin', 24 * 60, (err, count) => {
                if (err) reject(err);
                else resolve(count);
            });
        });

        console.log(`📊 admin still has ${adminFailedCount} failed attempts`);

        console.log('\n6️⃣ Testing results:');
        
        if (failedCount > 0 && failedCountAfter === 0 && adminFailedCount > 0) {
            console.log('✅ ALL TESTS PASSED!');
            console.log('   - Failed attempts were properly counted');
            console.log('   - Reset function removed only the target user\'s failed attempts');
            console.log('   - Other users\' attempts were not affected');
        } else {
            console.log('❌ TESTS FAILED!');
            console.log(`   - Initial count: ${failedCount}`);
            console.log(`   - After reset: ${failedCountAfter}`);
            console.log(`   - Admin count: ${adminFailedCount}`);
        }

        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        await new Promise((resolve, reject) => {
            db.db.run(
                `DELETE FROM login_attempts WHERE user_agent = 'Test Agent'`,
                function(err) {
                    if (err) reject(err);
                    else {
                        console.log(`✅ Cleaned up ${this.changes} test records`);
                        resolve();
                    }
                }
            );
        });

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        db.close();
    }
}

testResetFunctionality();