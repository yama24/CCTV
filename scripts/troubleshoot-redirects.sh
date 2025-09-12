#!/bin/bash

# Redirect Loop Troubleshooter for CCTV Apache Setup
echo "=== CCTV Redirect Loop Troubleshooter ==="
echo ""

# Get domain name
echo "Enter your domain name:"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain name is required"
    exit 1
fi

echo ""
echo "🔍 Checking for redirect loops on: $DOMAIN"
echo ""

# Test HTTP redirect
echo "1️⃣ Testing HTTP to HTTPS redirect..."
HTTP_RESPONSE=$(curl -s -I -L --max-redirs 5 "http://$DOMAIN" 2>/dev/null | head -1)
if [ $? -eq 0 ]; then
    echo "✅ HTTP redirect works: $HTTP_RESPONSE"
else
    echo "❌ HTTP redirect failed or too many redirects"
fi

echo ""

# Test HTTPS directly
echo "2️⃣ Testing HTTPS direct access..."
HTTPS_RESPONSE=$(curl -s -I -k --max-redirs 5 "https://$DOMAIN" 2>/dev/null | head -1)
if [ $? -eq 0 ]; then
    echo "✅ HTTPS direct access works: $HTTPS_RESPONSE"
else
    echo "❌ HTTPS direct access failed or too many redirects"
fi

echo ""

# Test with verbose curl to see redirect chain
echo "3️⃣ Checking redirect chain (first 3 redirects)..."
curl -s -I -L --max-redirs 3 -v "https://$DOMAIN" 2>&1 | grep -E "(HTTP/|Location:|< Server:|> GET|> Host:)" | head -10

echo ""

# Check Apache error logs
echo "4️⃣ Recent Apache errors (last 5 lines)..."
if [ -f "/var/log/apache2/error.log" ]; then
    sudo tail -5 /var/log/apache2/error.log 2>/dev/null || echo "Cannot access Apache error log"
else
    echo "Apache error log not found"
fi

echo ""

# Check if Node.js is running
echo "5️⃣ Checking Node.js CCTV application..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Node.js CCTV app is running"
    echo "Process details:"
    ps aux | grep "node.*server.js" | grep -v grep
else
    echo "❌ Node.js CCTV app is not running"
    echo "Start it with: cd /home/yama/CCTV && npm start"
fi

echo ""

# Test direct connection to Node.js
echo "6️⃣ Testing direct Node.js connection..."
NODE_RESPONSE=$(curl -s -I "http://localhost:3000" 2>/dev/null | head -1)
if [ $? -eq 0 ]; then
    echo "✅ Node.js responds directly: $NODE_RESPONSE"
else
    echo "❌ Node.js not responding on localhost:3000"
fi

echo ""

# Check Apache virtual host
echo "7️⃣ Checking Apache virtual host configuration..."
VHOST_FILE="/etc/apache2/sites-available/${DOMAIN}.conf"
if [ -f "$VHOST_FILE" ]; then
    echo "✅ Virtual host file exists: $VHOST_FILE"
    if grep -q "RewriteRule.*https" "$VHOST_FILE"; then
        echo "⚠️  Found redirect rules in virtual host"
    else
        echo "✅ No problematic redirect rules found"
    fi
else
    echo "❌ Virtual host file not found: $VHOST_FILE"
fi

echo ""
echo "🔧 Common Solutions:"
echo ""
echo "1. If you get 'too many redirects':"
echo "   - Make sure your Node.js app has 'app.set(\"trust proxy\", 1)'"
echo "   - Check that session cookie is set to 'secure: \"auto\"'"
echo "   - Restart both Apache and Node.js"
echo ""
echo "2. If Node.js is not running:"
echo "   cd /home/yama/CCTV && npm start"
echo ""
echo "3. If Apache config has issues:"
echo "   sudo apache2ctl configtest"
echo "   sudo systemctl reload apache2"
echo ""
echo "4. If SSL cert is missing:"
echo "   sudo certbot --apache -d $DOMAIN"
echo ""
echo "5. To restart everything:"
echo "   sudo systemctl restart apache2"
echo "   cd /home/yama/CCTV && npm run pm2:restart"