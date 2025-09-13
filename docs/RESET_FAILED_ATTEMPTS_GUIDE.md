# Reset Failed Login Attempts - User Guide

## Overview
The CCTV system tracks failed login attempts to prevent brute force attacks. When users fail to login multiple times, they may be temporarily locked out. This feature allows administrators to reset failed login attempts for users who may have legitimately forgotten their password or experienced login issues.

## Features Added

### 1. Database Methods
- `resetFailedLoginAttempts(username, callback)` - Removes all failed login attempts for a specific user
- `getFailedLoginAttemptsCount(username, minutes, callback)` - Gets the count of failed attempts for a user within a time period

### 2. User Manager Integration
The user management script (`scripts/user-manager.js`) now includes:

#### Interactive Menu Option
- **Option 5**: Reset failed login attempts
  - Shows all users with recent failed attempts (last 24 hours)
  - Displays count and timestamp of last failed attempt
  - Allows resetting for a specific user or all users

#### Command Line Usage
```bash
# Interactive reset (shows menu with users who have failed attempts)
node scripts/user-manager.js reset-attempts

# Reset for a specific user directly
node scripts/user-manager.js reset-attempts username

# Examples:
node scripts/user-manager.js reset-attempts admin
node scripts/user-manager.js reset-attempts john_doe
```

## Usage Examples

### Interactive Mode
```bash
cd /path/to/cctv
node scripts/user-manager.js
# Select option 5 from the menu
# View users with failed attempts
# Enter username to reset or "all" for everyone
```

### Command Line Mode
```bash
# Reset specific user
node scripts/user-manager.js reset-attempts admin

# Interactive selection
node scripts/user-manager.js reset-attempts
```

## What Gets Reset
- **Removed**: All failed login attempts for the specified user(s)
- **Kept**: Successful login attempts (for audit purposes)
- **Kept**: Failed attempts for other users (if resetting specific user)

## Security Considerations
- Only failed attempts are removed, successful logins remain for audit trails
- The feature shows when failed attempts occurred to help identify patterns
- Administrators can see which users are experiencing login issues
- The reset action is logged in the application

## Output Examples

### Successful Reset
```
✅ Reset 5 failed login attempts for user "john_doe"
🔓 User "john_doe" can now login normally
```

### No Failed Attempts
```
ℹ️  User "admin" has no recent failed login attempts
```

### User Not Found
```
❌ User not found
```

## Integration with Login System
After resetting failed attempts:
1. The user can immediately attempt to login again
2. No lockout periods apply
3. Login rate limiting starts fresh for that user
4. Normal security measures remain in place

## Best Practices
1. **Investigate First**: Before resetting, check if the failed attempts are legitimate
2. **User Communication**: Inform users when their attempts are reset
3. **Monitor Patterns**: Use the display feature to identify users who frequently need resets
4. **Documentation**: Keep track of when and why resets are performed

## Troubleshooting
If the reset doesn't work:
1. Verify the username is correct (case-sensitive)
2. Check that the user exists in the system
3. Ensure the database is accessible and not locked
4. Check the application logs for any error messages