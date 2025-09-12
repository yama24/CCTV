#!/usr/bin/env node

// Quick setup script to create the initial admin user
const bcrypt = require('bcrypt');
const Database = require('./database');

async function createInitialAdmin() {
    console.log('🔐 Creating initial admin user...');
    
    const db = new Database();
    
    try {
        // Wait a bit for database initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if any users exist
        const existingUsers = await new Promise((resolve, reject) => {
            db.db.all('SELECT COUNT(*) as count FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows[0].count);
            });
        });
        
        if (existingUsers > 0) {
            console.log('ℹ️  Users already exist. Use user-manager.js to manage users.');
            db.close();
            return;
        }
        
        // Create default admin user
        const username = 'admin';
        const password = 'password'; // Default password - should be changed immediately
        const passwordHash = await bcrypt.hash(password, 10);
        
        const userId = await new Promise((resolve, reject) => {
            db.createUser({
                username: username,
                passwordHash: passwordHash,
                email: 'admin@localhost',
                fullName: 'Administrator',
                role: 'admin'
            }, (err, userId) => {
                if (err) reject(err);
                else resolve(userId);
            });
        });
        
        console.log('✅ Initial admin user created successfully!');
        console.log('');
        console.log('📋 Default Credentials:');
        console.log('   Username: admin');
        console.log('   Password: password');
        console.log('');
        console.log('⚠️  SECURITY WARNING:');
        console.log('   Change the default password immediately!');
        console.log('   Run: node user-manager.js');
        console.log('   Then select option 3 to change the password.');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error creating initial admin user:', error.message);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    createInitialAdmin();
}

module.exports = createInitialAdmin;