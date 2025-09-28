"""
Test script for Articles API endpoints
Run this to verify the articles system is working correctly
"""

import requests
import json

# Configuration
BASE_URL = "http://127.0.0.1:8000/api/v1"
HEADERS = {
    "X-User-ID": "1",  # Replace with valid user ID
    "X-RFID": "your_rfid_code",  # Replace with valid RFID
    "Content-Type": "application/json"
}

def test_get_all_articles():
    """Test getting all articles"""
    print("🔍 Testing GET /articles/")
    response = requests.get(f"{BASE_URL}/articles/")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Found {data['total_count']} total articles, {data['active_count']} active")
        print(f"📰 Sample titles: {[article['title'][:50] for article in data['articles'][:3]]}")
    else:
        print(f"❌ Error: {response.text}")
    print("-" * 60)

def test_search_articles():
    """Test searching articles"""
    print("🔍 Testing GET /articles/search/")
    response = requests.get(f"{BASE_URL}/articles/search/?q=web&active_only=true")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        articles = response.json()
        print(f"✅ Found {len(articles)} articles matching 'web'")
        if articles:
            print(f"📰 First result: {articles[0]['title']}")
    else:
        print(f"❌ Error: {response.text}")
    print("-" * 60)

def test_get_featured_articles():
    """Test getting featured articles"""
    print("🔍 Testing GET /articles/featured/")
    response = requests.get(f"{BASE_URL}/articles/featured/")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        articles = response.json()
        print(f"✅ Found {len(articles)} featured articles")
    else:
        print(f"❌ Error: {response.text}")
    print("-" * 60)

def test_get_stats():
    """Test getting article statistics"""
    print("🔍 Testing GET /articles/stats/")
    response = requests.get(f"{BASE_URL}/articles/stats/")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        stats = response.json()
        print(f"✅ Statistics retrieved successfully:")
        print(f"   Total: {stats['total_articles']}")
        print(f"   Active: {stats['active_articles']}")
        print(f"   Featured: {stats['featured_articles']}")
        print(f"   Categories: {len(stats['by_category'])}")
    else:
        print(f"❌ Error: {response.text}")
    print("-" * 60)

def test_create_article():
    """Test creating a new article"""
    print("🔍 Testing POST /articles/ (Create)")
    
    new_article = {
        "title": "Test API Article",
        "author": "API Tester",
        "date_written": "2024-09-27",
        "story": "sample articles",
        "content": json.dumps({
            "title": "Test API Article",
            "intro": "This is a test article created via API",
            "highlights": [
                {
                    "title": "API Testing",
                    "content": "Testing the articles API endpoints"
                }
            ],
            "cards": [
                {
                    "title": "Test Card",
                    "content": "Test content",
                    "list": ["Item 1", "Item 2"]
                }
            ],
            "sections": [
                {
                    "title": "Test Section",
                    "content": "Test section content",
                    "list": ["Point 1", "Point 2"]
                }
            ]
        }),
        "excerpt": "A test article for API validation",
        "category": "test",
        "tags": "api, test, validation",
        "word_count": 50,
        "reading_time_minutes": 1,
        "is_active": True,
        "is_featured": False
    }
    
    response = requests.post(f"{BASE_URL}/articles/", json=new_article, headers=HEADERS)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        article = response.json()
        print(f"✅ Article created with ID: {article['id']}")
        return article['id']
    else:
        print(f"❌ Error: {response.text}")
        return None
    print("-" * 60)

def test_update_article(article_id):
    """Test updating an article"""
    if not article_id:
        print("⚠️ Skipping update test - no article ID")
        return
        
    print(f"🔍 Testing PATCH /articles/{article_id}/ (Update)")
    
    update_data = {
        "title": "Updated Test API Article",
        "excerpt": "Updated excerpt for the test article"
    }
    
    response = requests.patch(f"{BASE_URL}/articles/{article_id}/", json=update_data, headers=HEADERS)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        article = response.json()
        print(f"✅ Article updated: {article['title']}")
    else:
        print(f"❌ Error: {response.text}")
    print("-" * 60)

def test_delete_article(article_id):
    """Test deleting an article"""
    if not article_id:
        print("⚠️ Skipping delete test - no article ID")
        return
        
    print(f"🔍 Testing DELETE /articles/{article_id}/ (Delete)")
    
    response = requests.delete(f"{BASE_URL}/articles/{article_id}/", headers=HEADERS)
    print(f"Status: {response.status_code}")
    if response.status_code == 204:
        print(f"✅ Article deleted successfully")
    else:
        print(f"❌ Error: {response.text}")
    print("-" * 60)

def main():
    """Run all tests"""
    print("🚀 ARTICLES API TEST SUITE")
    print("=" * 60)
    print("⚠️ Make sure your FastAPI server is running!")
    print("⚠️ Update HEADERS with valid user credentials!")
    print("=" * 60)
    
    # Test read operations (no auth required)
    test_get_all_articles()
    test_search_articles()
    test_get_featured_articles()
    test_get_stats()
    
    # Test CRUD operations (auth required)
    print("🔐 Testing authenticated operations...")
    article_id = test_create_article()
    test_update_article(article_id)
    test_delete_article(article_id)
    
    print("🏁 Test suite completed!")

if __name__ == "__main__":
    main()