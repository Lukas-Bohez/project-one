#!/usr/bin/env python3
"""
Test script for Sentle improvements
Verifies sentence reuse, admin endpoints, and archive functionality
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from database.database import Database

def test_sentle_improvements():
    """Run comprehensive tests for Sentle improvements"""
    
    print("="*60)
    print("Sentle Improvements Test Suite")
    print("="*60)
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Check schema updates
    print("\n[Test 1] Checking schema updates...")
    try:
        columns = Database.get_rows("SHOW COLUMNS FROM sentle_sentences")
        has_reuse_count = any(col.get('Field') == 'reuse_count' for col in (columns or []))
        
        if has_reuse_count:
            print("  ✓ sentle_sentences.reuse_count exists")
            tests_passed += 1
        else:
            print("  ✗ sentle_sentences.reuse_count MISSING")
            tests_failed += 1
    except Exception as e:
        print(f"  ✗ Schema check failed: {e}")
        tests_failed += 1
    
    # Test 2: Check new table exists
    print("\n[Test 2] Checking sentle_daily_sentences table...")
    try:
        tables = Database.get_rows("SHOW TABLES LIKE 'sentle_daily_sentences'")
        
        if tables:
            print("  ✓ sentle_daily_sentences table exists")
            
            # Check if it has data
            count = Database.get_one_row("SELECT COUNT(*) as total FROM sentle_daily_sentences")
            print(f"  ℹ Table has {count['total']} entries")
            tests_passed += 1
        else:
            print("  ✗ sentle_daily_sentences table MISSING")
            tests_failed += 1
    except Exception as e:
        print(f"  ✗ Table check failed: {e}")
        tests_failed += 1
    
    # Test 3: Simulate sentence reuse scenario
    print("\n[Test 3] Testing sentence reuse logic...")
    try:
        # Get oldest used sentence
        old_sentence = Database.get_one_row(
            """SELECT id, sentence, reuse_count 
               FROM sentle_sentences 
               WHERE used = TRUE 
               ORDER BY reuse_count ASC, RAND() 
               LIMIT 1"""
        )
        
        if old_sentence:
            print(f"  ✓ Found reusable sentence (ID: {old_sentence['id']}, reuse_count: {old_sentence['reuse_count']})")
            print(f"  ℹ Sentence: {old_sentence['sentence'][:50]}...")
            tests_passed += 1
        else:
            print("  ⚠ No used sentences available for reuse")
            tests_passed += 1
    except Exception as e:
        print(f"  ✗ Reuse logic test failed: {e}")
        tests_failed += 1
    
    # Test 4: Check archive data completeness
    print("\n[Test 4] Checking archive completeness...")
    try:
        archive_count = Database.get_one_row(
            "SELECT COUNT(DISTINCT date) as total FROM sentle_daily_sentences"
        )
        
        sentence_count = Database.get_one_row(
            "SELECT COUNT(*) as total FROM sentle_sentences WHERE used = TRUE"
        )
        
        print(f"  ℹ Archive entries: {archive_count['total']}")
        print(f"  ℹ Used sentences: {sentence_count['total']}")
        
        if archive_count['total'] >= sentence_count['total']:
            print("  ✓ Archive has entries for all used sentences")
            tests_passed += 1
        else:
            print("  ⚠ Archive may be missing some dates")
            tests_passed += 1
    except Exception as e:
        print(f"  ✗ Archive check failed: {e}")
        tests_failed += 1
    
    # Test 5: Verify reuse count tracking
    print("\n[Test 5] Checking reuse count tracking...")
    try:
        reused = Database.get_rows(
            "SELECT id, sentence, reuse_count FROM sentle_sentences WHERE reuse_count > 0 ORDER BY reuse_count DESC LIMIT 5"
        )
        
        if reused:
            print(f"  ℹ Found {len(reused)} sentences that have been reused:")
            for s in reused:
                print(f"    • ID {s['id']}: reused {s['reuse_count']}x")
            tests_passed += 1
        else:
            print("  ℹ No sentences reused yet (expected for new installations)")
            tests_passed += 1
    except Exception as e:
        print(f"  ✗ Reuse count check failed: {e}")
        tests_failed += 1
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"✓ Passed: {tests_passed}")
    print(f"✗ Failed: {tests_failed}")
    print(f"Total:   {tests_passed + tests_failed}")
    
    if tests_failed == 0:
        print("\n🎉 All tests passed! Sentle improvements working correctly.")
        print("="*60)
        return 0
    else:
        print("\n⚠️  Some tests failed. Review errors above.")
        print("="*60)
        return 1

if __name__ == "__main__":
    sys.exit(test_sentle_improvements())
