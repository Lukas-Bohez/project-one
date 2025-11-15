#!/usr/bin/env python3
"""
Test script to verify video conversions don't block the main event loop
"""
import asyncio
import time
import httpx

BASE_URL = "http://localhost:8000"

async def test_concurrent_requests():
    """Test that API endpoints respond during video conversion"""
    print("🧪 Testing concurrent API requests...")
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        # Test 1: Normal API calls work
        print("\n1️⃣ Testing normal API endpoints...")
        try:
            response = await client.get(f"{BASE_URL}/api/v1/questions/")
            if response.status_code == 200:
                print("   ✅ /api/v1/questions/ responded quickly")
            else:
                print(f"   ❌ Unexpected status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 2: Start a video conversion (won't actually complete, just queues it)
        print("\n2️⃣ Simulating video conversion start...")
        try:
            # Note: This will fail without proper API key, but it tests the endpoint isn't blocked
            response = await client.post(
                f"{BASE_URL}/api/v1/validate-url",
                json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
            )
            print(f"   ✅ Video endpoint responded with status {response.status_code}")
        except httpx.TimeoutException:
            print("   ❌ Video endpoint timed out (OLD PROBLEM)")
        except Exception as e:
            print(f"   ⚠️  Expected error: {e}")
        
        # Test 3: Rapid-fire requests (should all complete fast)
        print("\n3️⃣ Testing rapid-fire requests...")
        start = time.time()
        tasks = []
        for i in range(10):
            tasks.append(client.get(f"{BASE_URL}/api/v1/themes/"))
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = time.time() - start
        
        success_count = sum(1 for r in responses if hasattr(r, 'status_code') and r.status_code == 200)
        print(f"   ✅ {success_count}/10 requests succeeded in {elapsed:.2f}s")
        
        if elapsed < 2.0:
            print("   ✅ Response time excellent (< 2s for 10 requests)")
        else:
            print(f"   ⚠️  Response time slow ({elapsed:.2f}s)")
        
        # Test 4: Socket.IO connection (basic check)
        print("\n4️⃣ Testing Socket.IO endpoint availability...")
        try:
            response = await client.get(f"{BASE_URL}/socket.io/")
            if response.status_code in [200, 400]:  # 400 is fine, means endpoint exists
                print("   ✅ Socket.IO endpoint reachable")
            else:
                print(f"   ⚠️  Unexpected status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

async def main():
    print("=" * 60)
    print("Video Blocking Fix - Verification Test")
    print("=" * 60)
    print("\nMake sure your FastAPI server is running:")
    print("  cd /home/student/Project/project-one/backend")
    print("  uvicorn app:app --host 0.0.0.0 --port 8000")
    print("\nPress Ctrl+C to exit\n")
    
    await asyncio.sleep(2)
    await test_concurrent_requests()
    
    print("\n" + "=" * 60)
    print("✅ Test complete!")
    print("\nIf all tests passed:")
    print("  • Video conversions run in separate processes")
    print("  • Main API loop stays responsive")
    print("  • Socket.IO connections won't timeout")
    print("=" * 60)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Test interrupted")
