#!/usr/bin/env node

const bcrypt = require('bcrypt');
const Database = require('../database');
const readline = require('readline');
const prompt = require('prompt-sync')({ sigint: true });

class UserManager {
    constructor() {
        this.db = new Database();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });
    }
    
    cleanup() {
        try {
            if (this.rl) {
                this.rl.close();
            }
            if (this.db) {
                this.db.close();
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }

    askQuestion(question) {
        return new Promise((resolve) => {
            try {
                const answer = prompt(question);
                resolve(answer || '');
            } catch (error) {
                // Fallback to readline
                this.rl.question(question, (answer) => {
                    resolve(answer);
                });
            }
        });
    }

    askPasswordQuestion(question) {
        try {
            // Use prompt-sync with hidden input
            const password = prompt(question, { echo: '*' });
            return Promise.resolve(password || '');
        } catch (error) {
            // Fallback to visible input
            console.log('⚠️  Warning: Password input will be visible');
            return new Promise((resolve) => {
                this.rl.question(question, (password) => {
                    resolve(password || '');
                });
            });
        }
    }

    validateUsername(username) {
        if (!username || username.length < 3) {
            return 'Username must be at least 3 characters long';
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return 'Username can only contain letters, numbers, underscores, and hyphens';
        }
        return null;
    }

    validatePassword(password) {
        if (!password || password.length < 6) {
            return 'Password must be at least 6 characters long';
        }
        return null;
    }

    validateEmail(email) {
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return 'Invalid email format';
        }
        return null;
    }

    async addUser() {
        console.log('\n📝 Add New User\n');
        
        try {
            // Get username
            let username;
            while (true) {
                username = await this.askQuestion('Username: ');
                const usernameError = this.validateUsername(username);
                if (usernameError) {
                    console.log(`❌ ${usernameError}`);
                    continue;
                }
                
                // Check if username already exists
                const existingUser = await new Promise((resolve, reject) => {
                    this.db.getUserByUsername(username, (err, user) => {
                        if (err) reject(err);
                        else resolve(user);
                    });
                });
                
                if (existingUser) {
                    console.log('❌ Username already exists');
                    continue;
                }
                
                break;
            }

            // Get password
            let password;
            while (true) {
                password = await this.askPasswordQuestion('Password: ');
                const passwordError = this.validatePassword(password);
                if (passwordError) {
                    console.log(`❌ ${passwordError}`);
                    continue;
                }
                
                const confirmPassword = await this.askPasswordQuestion('Confirm Password: ');
                if (password !== confirmPassword) {
                    console.log('❌ Passwords do not match');
                    continue;
                }
                
                break;
            }

            // Get optional fields
            const email = await this.askQuestion('Email (optional): ');
            const emailError = this.validateEmail(email);
            if (emailError) {
                console.log(`❌ ${emailError}`);
                return;
            }

            const fullName = await this.askQuestion('Full Name (optional): ');
            
            let role;
            while (true) {
                role = await this.askQuestion('Role (admin/user) [user]: ');
                if (!role) role = 'user';
                if (['admin', 'user'].includes(role.toLowerCase())) {
                    role = role.toLowerCase();
                    break;
                }
                console.log('❌ Role must be either "admin" or "user"');
            }

            // Hash password
            console.log('🔐 Hashing password...');
            const passwordHash = await this.hashPassword(password);

            // Create user
            const userId = await new Promise((resolve, reject) => {
                this.db.createUser({
                    username,
                    passwordHash,
                    email: email || null,
                    fullName: fullName || null,
                    role
                }, (err, userId) => {
                    if (err) reject(err);
                    else resolve(userId);
                });
            });

            console.log(`✅ User created successfully!`);
            console.log(`   User ID: ${userId}`);
            console.log(`   Username: ${username}`);
            console.log(`   Email: ${email || 'Not provided'}`);
            console.log(`   Full Name: ${fullName || 'Not provided'}`);
            console.log(`   Role: ${role}`);

        } catch (error) {
            console.error('❌ Error creating user:', error.message);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    }

    async listUsers() {
        console.log('\n👥 User List\n');
        
        try {
            const users = await new Promise((resolve, reject) => {
                this.db.db.all(
                    'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC',
                    (err, users) => {
                        if (err) reject(err);
                        else resolve(users);
                    }
                );
            });

            if (users.length === 0) {
                console.log('No users found.');
                return;
            }

            console.log('ID | Username     | Role  | Active | Created         | Last Login');
            console.log('---|--------------|-------|--------|-----------------|------------------');
            
            users.forEach(user => {
                const active = user.is_active ? '✅' : '❌';
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
                const created = new Date(user.created_at).toLocaleDateString();
                
                console.log(`${user.id.toString().padEnd(2)} | ${user.username.padEnd(12)} | ${user.role.padEnd(5)} | ${active.padEnd(6)} | ${created.padEnd(15)} | ${lastLogin}`);
            });

        } catch (error) {
            console.error('❌ Error listing users:', error.message);
        }
    }

    async deleteUser() {
        console.log('\n🗑️  Delete User\n');
        
        try {
            const username = await this.askQuestion('Username to delete: ');
            
            const user = await new Promise((resolve, reject) => {
                this.db.getUserByUsername(username, (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            });

            if (!user) {
                console.log('❌ User not found');
                return;
            }

            console.log(`User found: ${user.username} (${user.full_name || 'No full name'}) - Role: ${user.role}`);
            const confirm = await this.askQuestion('Are you sure you want to delete this user? (yes/no): ');
            
            if (confirm.toLowerCase() !== 'yes') {
                console.log('❌ Deletion cancelled');
                return;
            }

            await new Promise((resolve, reject) => {
                this.db.db.run(
                    'UPDATE users SET is_active = 0 WHERE id = ?',
                    [user.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log('✅ User deactivated successfully');

        } catch (error) {
            console.error('❌ Error deleting user:', error.message);
        }
    }

    async changePassword() {
        console.log('\n🔑 Change User Password\n');
        
        try {
            const username = await this.askQuestion('Username: ');
            
            const user = await new Promise((resolve, reject) => {
                this.db.getUserByUsername(username, (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            });

            if (!user) {
                console.log('❌ User not found');
                return;
            }

            let password;
            while (true) {
                password = await this.askPasswordQuestion('New Password: ');
                const passwordError = this.validatePassword(password);
                if (passwordError) {
                    console.log(`❌ ${passwordError}`);
                    continue;
                }
                
                const confirmPassword = await this.askPasswordQuestion('Confirm New Password: ');
                if (password !== confirmPassword) {
                    console.log('❌ Passwords do not match');
                    continue;
                }
                
                break;
            }

            const passwordHash = await this.hashPassword(password);

            await new Promise((resolve, reject) => {
                this.db.db.run(
                    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [passwordHash, user.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log('✅ Password changed successfully');

        } catch (error) {
            console.error('❌ Error changing password:', error.message);
        }
    }

    async resetFailedAttempts() {
        console.log('\n🔄 Reset Failed Login Attempts\n');
        
        try {
            // First show users with failed attempts
            console.log('📊 Current users with failed login attempts:');
            const usersWithFailedAttempts = await new Promise((resolve, reject) => {
                this.db.db.all(
                    `SELECT u.username, u.full_name, COUNT(la.id) as failed_attempts,
                            MAX(la.timestamp) as last_failed_attempt
                     FROM users u 
                     JOIN login_attempts la ON u.username = la.username 
                     WHERE la.success = 0 
                     AND la.timestamp > datetime('now', '-24 hours')
                     GROUP BY u.username, u.full_name
                     ORDER BY failed_attempts DESC`,
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            if (usersWithFailedAttempts.length === 0) {
                console.log('✅ No users with failed login attempts in the last 24 hours');
                return;
            }

            console.log('\nUsername\t\tFailed Attempts\tLast Failed Attempt');
            console.log('─'.repeat(70));
            usersWithFailedAttempts.forEach((user, index) => {
                const lastAttempt = new Date(user.last_failed_attempt).toLocaleString();
                console.log(`${index + 1}. ${user.username.padEnd(15)}\t${user.failed_attempts}\t\t${lastAttempt}`);
            });

            const choice = await this.askQuestion('\nEnter username to reset (or "all" to reset all): ');
            
            if (!choice) {
                console.log('❌ Operation cancelled');
                return;
            }

            if (choice.toLowerCase() === 'all') {
                // Reset all failed attempts
                const result = await new Promise((resolve, reject) => {
                    this.db.db.run(
                        'DELETE FROM login_attempts WHERE success = 0',
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        }
                    );
                });
                console.log(`✅ Reset failed login attempts for all users (${result} records removed)`);
            } else {
                // Validate username exists
                const user = await new Promise((resolve, reject) => {
                    this.db.getUserByUsername(choice, (err, user) => {
                        if (err) reject(err);
                        else resolve(user);
                    });
                });

                if (!user) {
                    console.log('❌ User not found');
                    return;
                }

                // Check current failed attempts for this user
                const failedCount = await new Promise((resolve, reject) => {
                    this.db.getFailedLoginAttemptsCount(choice, 24 * 60, (err, count) => {
                        if (err) reject(err);
                        else resolve(count);
                    });
                });

                if (failedCount === 0) {
                    console.log(`ℹ️  User "${choice}" has no recent failed login attempts`);
                    return;
                }

                // Reset failed attempts for specific user
                const result = await new Promise((resolve, reject) => {
                    this.db.resetFailedLoginAttempts(choice, (err, changes) => {
                        if (err) reject(err);
                        else resolve(changes);
                    });
                });

                console.log(`✅ Reset ${result} failed login attempts for user "${choice}"`);
                console.log(`🔓 User "${choice}" can now login normally`);
            }

        } catch (error) {
            console.error('❌ Error resetting failed attempts:', error.message);
        }
    }

    async resetFailedAttemptsForUser(username) {
        console.log(`🔄 Resetting failed login attempts for user: ${username}\n`);
        
        try {
            // Validate username exists
            const user = await new Promise((resolve, reject) => {
                this.db.getUserByUsername(username, (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            });

            if (!user) {
                console.log('❌ User not found');
                return;
            }

            // Check current failed attempts
            const failedCount = await new Promise((resolve, reject) => {
                this.db.getFailedLoginAttemptsCount(username, 24 * 60, (err, count) => {
                    if (err) reject(err);
                    else resolve(count);
                });
            });

            if (failedCount === 0) {
                console.log(`ℹ️  User "${username}" has no recent failed login attempts`);
                return;
            }

            // Reset failed attempts
            const result = await new Promise((resolve, reject) => {
                this.db.resetFailedLoginAttempts(username, (err, changes) => {
                    if (err) reject(err);
                    else resolve(changes);
                });
            });

            console.log(`✅ Reset ${result} failed login attempts for user "${username}"`);
            console.log(`🔓 User "${username}" can now login normally`);

        } catch (error) {
            console.error('❌ Error resetting failed attempts:', error.message);
        }
    }

    async showMenu() {
        console.log('\n🔐 CCTV User Management\n');
        console.log('1. Add new user');
        console.log('2. List all users');
        console.log('3. Change user password');
        console.log('4. Delete (deactivate) user');
        console.log('5. Reset failed login attempts');
        console.log('6. Exit');
        
        const choice = await this.askQuestion('\nSelect option (1-6): ');
        
        switch (choice) {
            case '1':
                await this.addUser();
                break;
            case '2':
                await this.listUsers();
                break;
            case '3':
                await this.changePassword();
                break;
            case '4':
                await this.deleteUser();
                break;
            case '5':
                await this.resetFailedAttempts();
                break;
            case '6':
                console.log('👋 Goodbye!');
                this.cleanup();
                return false;
            default:
                console.log('❌ Invalid option');
        }
        
        return true;
    }

    async run() {
        console.log('🔐 CCTV User Management System');
        console.log('================================');
        
        // Wait for database initialization to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let continueRunning = true;
        while (continueRunning) {
            continueRunning = await this.showMenu();
        }
    }
}

// Check command line arguments for direct operations
const args = process.argv.slice(2);
const userManager = new UserManager();

if (args.length > 0) {
    // Wait for database initialization
    setTimeout(() => {
        switch (args[0]) {
            case 'add':
                userManager.addUser().then(() => {
                    userManager.cleanup();
                }).catch((error) => {
                    console.error('❌ Error:', error.message);
                    userManager.cleanup();
                });
                break;
            case 'list':
                userManager.listUsers().then(() => {
                    userManager.cleanup();
                }).catch((error) => {
                    console.error('❌ Error:', error.message);
                    userManager.cleanup();
                });
                break;
            case 'reset-attempts':
                if (args[1]) {
                    // Reset for specific user
                    userManager.resetFailedAttemptsForUser(args[1]).then(() => {
                        userManager.cleanup();
                    }).catch((error) => {
                        console.error('❌ Error:', error.message);
                        userManager.cleanup();
                    });
                } else {
                    // Interactive reset
                    userManager.resetFailedAttempts().then(() => {
                        userManager.cleanup();
                    }).catch((error) => {
                        console.error('❌ Error:', error.message);
                        userManager.cleanup();
                    });
                }
                break;
            default:
                console.log('Usage: node scripts/user-manager.js [add|list|reset-attempts [username]]');
                console.log('Examples:');
                console.log('  node scripts/user-manager.js reset-attempts          # Interactive reset');
                console.log('  node scripts/user-manager.js reset-attempts john    # Reset for specific user');
                console.log('Or run without arguments for interactive menu');
                userManager.cleanup();
        }
    }, 500);
} else {
    userManager.run().catch((error) => {
        console.error('❌ Error:', error.message);
        userManager.cleanup();
    });
}