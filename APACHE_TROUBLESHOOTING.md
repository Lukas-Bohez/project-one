# Apache Server Error Troubleshooting Guide

## 🚨 Internal Server Error - Quick Fix Steps

### Step 1: Test with No .htaccess (FASTEST FIX)
```bash
# Remove .htaccess temporarily to test
cd /home/student/Project/project-one/frontend
mv .htaccess .htaccess.backup
```
**Test your website now**. If it works, the issue is in .htaccess.

### Step 2: Use Minimal Configuration
If removing .htaccess fixed it, try minimal config:
```bash
cp .htaccess.empty .htaccess
```

### Step 3: Use Emergency Script
```bash
./test-apache-config.sh
```

### Step 4: WebSocket Fallbacks
The WebSocket system now has Apache-specific fallbacks:
- Detects Apache CORS/403/500 errors
- Automatically switches to polling-only mode
- Uses longer timeouts for Apache environments
- Disables features that cause Apache issues

## 🔧 Manual Configuration Options

### Option A: Completely Remove .htaccess
```bash
rm frontend/.htaccess
```

### Option B: Use Ultra-Minimal .htaccess
```bash
echo "# Minimal config" > frontend/.htaccess
echo "<IfModule mod_headers.c>" >> frontend/.htaccess
echo "Header set Access-Control-Allow-Origin \"*\"" >> frontend/.htaccess
echo "</IfModule>" >> frontend/.htaccess
```

### Option C: Empty .htaccess
```bash
touch frontend/.htaccess
```

## 🌐 Testing After Changes

1. **Clear browser cache** (Ctrl+F5 or Cmd+Shift+R)
2. **Test main site**: https://quizthespire.duckdns.org
3. **Test diagnostic page**: https://quizthespire.duckdns.org/diagnostic.html
4. **Check console logs** for WebSocket connection details

## 📊 What the Enhanced WebSocket Does

- **Auto-detects Apache issues** and switches to polling
- **No WebSocket proxy required** - works with basic Apache
- **CORS-friendly configuration** that doesn't trigger Apache errors
- **Graceful degradation** if WebSocket fails
- **Enhanced error messages** to help diagnose issues

## 🎯 Expected Results

With the minimal .htaccess:
- ✅ Website loads without Apache errors
- ✅ WebSocket connects via polling (reliable)
- ✅ May upgrade to WebSocket if supported
- ✅ Works across all browsers

## 🔍 If Still Having Issues

1. Check Apache error logs on your server
2. Ensure Python backend is running on correct port
3. Verify domain DNS settings
4. Test with completely removed .htaccess first

The WebSocket system is now designed to work even with the most basic Apache configuration!