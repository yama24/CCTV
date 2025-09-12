#!/usr/bin/env node

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔐 CCTV Password Hash Generator');
console.log('Use this tool to generate secure password hashes for your users.\n');

rl.question('Enter the password to hash: ', async (password) => {
    if (password.length < 6) {
        console.log('❌ Password should be at least 6 characters long.');
        process.exit(1);
    }

    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);
        
        console.log('\n✅ Password hash generated successfully!');
        console.log('📋 Copy this hash to your server.js users object:');
        console.log(`'${hash}'`);
        console.log('\nExample usage in server.js:');
        console.log('const users = {');
        console.log(`    admin: '${hash}',`);
        console.log('    // ... other users');
        console.log('};');
        
    } catch (error) {
        console.error('❌ Error generating hash:', error);
    } finally {
        rl.close();
    }
});