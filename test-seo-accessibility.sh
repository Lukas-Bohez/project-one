#!/bin/bash

# Test script to verify robots.txt and sitemap accessibility
echo "🤖 Testing robots.txt and sitemap accessibility for quizthespire.duckdns.org"
echo "================================================"

# Test robots.txt
echo "📋 Testing robots.txt..."
curl -I "https://quizthespire.duckdns.org/robots.txt" 2>/dev/null | head -n 1
curl -s "https://quizthespire.duckdns.org/robots.txt" | head -n 5

echo ""
echo "🗺️ Testing sitemap.xml..."
curl -I "https://quizthespire.duckdns.org/sitemap.xml" 2>/dev/null | head -n 1

echo ""
echo "📰 Testing new article URL..."
curl -I "https://quizthespire.duckdns.org/articles/posts/2025-budget-cuts-health-impact.html" 2>/dev/null | head -n 1

echo ""
echo "📊 Testing articles index..."
curl -I "https://quizthespire.duckdns.org/articles/" 2>/dev/null | head -n 1

echo ""
echo "🎮 Testing Industrial Empire game..."
curl -I "https://quizthespire.duckdns.org/idleGame/" 2>/dev/null | head -n 1

echo ""
echo "================================================"
echo "✅ If all responses show '200 OK', your site is accessible to Google!"
echo "❌ If any show '404' or '403', there may be server configuration issues."
echo ""
echo "📋 Next steps:"
echo "1. Wait 24-48 hours for Google to re-crawl"
echo "2. Resubmit robots.txt in Google Search Console"
echo "3. Request indexing for your new article"