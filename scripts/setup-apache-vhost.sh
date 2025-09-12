#!/bin/bash

# Apache2 Virtual Host Setup Script for CCTV Application
# This script helps you set up the Apache2 virtual host configuration

echo "=== CCTV Apache2 Virtual Host Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script should be run as root (use sudo)"
    echo "   Example: sudo bash setup-apache-vhost.sh"
    exit 1
fi

# Get domain name from user
echo "📝 Please enter your domain name (e.g., cctv.example.com):"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain name is required"
    exit 1
fi

echo ""
echo "🔧 Setting up Apache2 virtual host for: $DOMAIN"

# Check if Apache2 is installed
if ! command -v apache2 &> /dev/null; then
    echo "❌ Apache2 is not installed. Please install it first:"
    echo "   sudo apt update && sudo apt install apache2"
    exit 1
fi

# Enable required Apache modules
echo "🔌 Enabling required Apache modules..."
a2enmod rewrite
a2enmod ssl
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod headers

# Copy and customize the virtual host configuration
VHOST_FILE="/etc/apache2/sites-available/${DOMAIN}.conf"
echo "📁 Creating virtual host file: $VHOST_FILE"

# Replace domain placeholder in the config file
sed "s/your-domain.com/$DOMAIN/g" /home/yama/CCTV/config/apache-vhost.conf > "$VHOST_FILE"

echo "✅ Virtual host configuration created"

# Disable default site if it's enabled
if [ -f "/etc/apache2/sites-enabled/000-default.conf" ]; then
    echo "🔄 Disabling default Apache site..."
    a2dissite 000-default
fi

# Enable the new site
echo "🔄 Enabling CCTV virtual host..."
a2ensite "$DOMAIN"

# Create document root for Let's Encrypt
mkdir -p /var/www/html/.well-known/acme-challenge/
chown -R www-data:www-data /var/www/html/.well-known/

# Test Apache configuration
echo "🔍 Testing Apache configuration..."
if apache2ctl configtest; then
    echo "✅ Apache configuration is valid"
    
    # Reload Apache
    echo "🔄 Reloading Apache..."
    systemctl reload apache2
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Point your domain DNS to this server's IP address"
    echo "2. Obtain Let's Encrypt certificate:"
    echo "   sudo certbot --apache -d $DOMAIN"
    echo "3. Make sure your CCTV Node.js app is running on port 3000"
    echo "4. Test your site at: https://$DOMAIN"
    echo ""
    echo "📝 Notes:"
    echo "- HTTP traffic will automatically redirect to HTTPS"
    echo "- WebSocket connections (Socket.IO) are properly configured"
    echo "- Security headers are enabled for better protection"
    echo ""
    echo "🔧 To start your CCTV application:"
    echo "   cd /home/yama/CCTV && npm start"
    echo "   or use PM2: npm run pm2:start"
    
else
    echo "❌ Apache configuration test failed"
    echo "Please check the configuration and try again"
    exit 1
fi