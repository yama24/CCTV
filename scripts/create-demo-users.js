#!/usr/bin/env node

// Batch user creation script for quick setup
const bcrypt = require('bcrypt');
const Database = require('../database');

async function createBatchUsers() {
    console.log('👥 Creating batch users for demonstration...');
    
    const db = new Database();
    
    // Sample users to create
    const users = [
        {
            username: 'user1',
            password: 'password123',
            email: 'user1@example.com',
            fullName: 'John Doe',
            role: 'user'
        },
        {
            username: 'user2',
            password: 'password123',
            email: 'user2@example.com',
            fullName: 'Jane Smith',
            role: 'user'
        },
        {
            username: 'moderator',
            password: 'moderator123',
            email: 'moderator@example.com',
            fullName: 'Mike Johnson',
            role: 'admin'
        }
    ];
    
    try {
        // Wait for database initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (const userData of users) {
            // Check if user already exists
            const existingUser = await new Promise((resolve, reject) => {
                db.getUserByUsername(userData.username, (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            });
            
            if (existingUser) {
                console.log(`⏭️  User '${userData.username}' already exists, skipping...`);
                continue;
            }
            
            // Hash password
            const passwordHash = await bcrypt.hash(userData.password, 10);
            
            // Create user
            const userId = await new Promise((resolve, reject) => {
                db.createUser({
                    username: userData.username,
                    passwordHash: passwordHash,
                    email: userData.email,
                    fullName: userData.fullName,
                    role: userData.role
                }, (err, userId) => {
                    if (err) reject(err);
                    else resolve(userId);
                });
            });
            
            console.log(`✅ Created user: ${userData.username} (${userData.role}) - ID: ${userId}`);
        }
        
        console.log('\n📋 User Creation Summary:');
        
        // List all users
        const allUsers = await new Promise((resolve, reject) => {
            db.db.all(
                'SELECT username, role, email, full_name, created_at FROM users ORDER BY created_at',
                (err, users) => {
                    if (err) reject(err);
                    else resolve(users);
                }
            );
        });
        
        console.log('\nUsername     | Role  | Email                | Full Name');
        console.log('-------------|-------|---------------------|------------------');
        allUsers.forEach(user => {
            console.log(`${user.username.padEnd(12)} | ${user.role.padEnd(5)} | ${(user.email || '').padEnd(19)} | ${user.full_name || ''}`);
        });
        
        console.log('\n🔐 Default Passwords:');
        console.log('   admin: password');
        console.log('   user1: password123');
        console.log('   user2: password123');
        console.log('   moderator: moderator123');
        console.log('\n⚠️  Change all default passwords in production!');
        
    } catch (error) {
        console.error('❌ Error creating batch users:', error.message);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    createBatchUsers();
}

module.exports = createBatchUsers;