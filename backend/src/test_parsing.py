#!/usr/bin/env python3
"""
Test Article Parsing Script
Tests parsing articles from content.js without database import
"""

import sys
import os
import json
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def extract_articles_from_js(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract articles from the content.js file
    """
    print(f"Reading articles from {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the contentArticles array - look for the start and end more carefully
    start_match = re.search(r'const\s+contentArticles\s*=\s*\[', content)
    if not start_match:
        raise ValueError("Could not find contentArticles array start in the file")
    
    start_pos = start_match.end() - 1  # Include the opening bracket
    
    # Find the closing bracket by counting brackets
    bracket_count = 0
    end_pos = start_pos
    
    for i, char in enumerate(content[start_pos:], start_pos):
        if char == '[':
            bracket_count += 1
        elif char == ']':
            bracket_count -= 1
            if bracket_count == 0:
                end_pos = i + 1
                break
    
    if bracket_count != 0:
        raise ValueError("Could not find matching closing bracket for contentArticles array")
    
    # Extract the array content
    articles_str = content[start_pos:end_pos]
    
    # Clean up JavaScript syntax for JSON parsing
    # Remove trailing commas before closing brackets/braces
    articles_str = re.sub(r',(\s*[}\]])', r'\1', articles_str)
    
    try:
        # Parse the JavaScript array as JSON
        articles = json.loads(articles_str)
        print(f"Successfully parsed {len(articles)} articles")
        return articles
    except json.JSONDecodeError as e:
        print(f"Error parsing articles JSON: {e}")
        # Save the problematic content to a file for debugging
        with open('/tmp/debug_articles.json', 'w') as f:
            f.write(articles_str)
        print("Saved problematic content to /tmp/debug_articles.json for debugging")
        
        print("First 1000 characters of articles string:")
        print(articles_str[:1000])
        print("Last 1000 characters:")
        print(articles_str[-1000:])
        
        raise

def main():
    """
    Test parsing function
    """
    # Path to the content.js file
    content_js_path = "/home/student/Project/project-one/frontend/js/content.js"
    
    if not os.path.exists(content_js_path):
        print(f"Error: Content file not found at {content_js_path}")
        return 1
    
    try:
        # Extract articles from content.js
        articles = extract_articles_from_js(content_js_path)
        
        if not articles:
            print("No articles found in content.js")
            return 1
        
        print(f"Found {len(articles)} articles")
        print(f"First article title: {articles[0].get('title', 'No title')}")
        print(f"First article keys: {list(articles[0].keys())}")
        
        # Show structure of first article
        print("\nFirst article structure:")
        first_article = articles[0]
        for key, value in first_article.items():
            if isinstance(value, str):
                print(f"  {key}: '{value[:100]}...' (string, {len(value)} chars)")
            elif isinstance(value, list):
                print(f"  {key}: list with {len(value)} items")
                if value and isinstance(value[0], dict):
                    print(f"    First item keys: {list(value[0].keys())}")
            else:
                print(f"  {key}: {type(value).__name__}")
        
        return 0
        
    except Exception as e:
        print(f"Error during parsing: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())