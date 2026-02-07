#!/bin/bash

# Apache Configuration Test Script
# This script helps test different .htaccess configurations

echo "🔧 Apache Configuration Test Script"
echo "=================================="
echo ""

FRONTEND_DIR="/home/student/Project/project-one/frontend"

echo "📋 Available .htaccess configurations:"
echo "1. Current (.htaccess) - Ultra-minimal"
echo "2. Minimal (.htaccess.minimal) - Emergency backup"  
echo "3. Empty (.htaccess.empty) - No directives at all"
echo ""

echo "🔍 Current .htaccess content:"
echo "----------------------------"
if [ -f "$FRONTEND_DIR/.htaccess" ]; then
    cat "$FRONTEND_DIR/.htaccess"
else
    echo "No .htaccess file found!"
fi
echo ""

echo "📋 To switch configurations:"
echo "----------------------------"
echo "For minimal config:"
echo "  cp $FRONTEND_DIR/.htaccess.minimal $FRONTEND_DIR/.htaccess"
echo ""
echo "For empty config:"
echo "  cp $FRONTEND_DIR/.htaccess.empty $FRONTEND_DIR/.htaccess"
echo ""
echo "To remove .htaccess entirely:"
echo "  rm $FRONTEND_DIR/.htaccess"
echo ""

echo "🌐 Test your website after each change:"
echo "  https://quizthespire.duckdns.org"
echo ""

echo "📊 If you still get errors, try this sequence:"
echo "1. Remove .htaccess completely"
echo "2. Test if site loads"
echo "3. If it works, gradually add back features"
echo ""

read -p "🔄 Switch to empty .htaccess now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cp "$FRONTEND_DIR/.htaccess.empty" "$FRONTEND_DIR/.htaccess"
    echo "✅ Switched to empty .htaccess configuration"
    echo "🌐 Test your website now!"
else
    echo "⏸️ No changes made. Current configuration preserved."
fi