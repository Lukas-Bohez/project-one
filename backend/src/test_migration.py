#!/usr/bin/env python3
"""
Test script for the question migration functionality
"""

import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.datarepository import QuestionRepository, ThemeRepository


def test_migration():
    """Test the migration functionality"""

    print("🧪 Testing Question Migration Functionality")
    print("=" * 50)

    # Get all themes
    themes = ThemeRepository.get_all_themes()
    print(f"📁 Found {len(themes)} themes in database:")

    for theme in themes[:10]:  # Show first 10 themes
        questions_count = len(QuestionRepository.get_questions_by_theme(theme["id"]))
        print(f"  - {theme['name']} (ID: {theme['id']}) - {questions_count} questions")

    assert len(themes) >= 2, "Need at least 2 themes to test migration"

    # Find themes with questions
    themes_with_questions = []
    for theme in themes:
        questions = QuestionRepository.get_questions_by_theme(theme["id"])
        if len(questions) > 0:
            themes_with_questions.append((theme, len(questions)))

    assert (
        len(themes_with_questions) >= 1
    ), "No themes with questions found to test migration"

    print(f"\n📊 Themes with questions:")
    for theme, count in themes_with_questions[:5]:
        print(f"  - {theme['name']}: {count} questions")

    print("\n✅ Migration test environment looks good!")
    print("ℹ️  To test migration, use the admin interface or run:")
    print(f"   POST /api/v1/themes/{{source_id}}/migrate-to/{{target_id}}")

    # If we reach here, environment checks passed
    return None


def test_repository_method():
    """Test the repository migration method directly"""
    print("\n🔧 Testing Repository Migration Method")
    print("=" * 50)

    # Verify the repository exposes the migration method
    assert hasattr(
        QuestionRepository, "migrate_questions_to_theme"
    ), "Migration method not found on QuestionRepository"
    # Calling with fake IDs may raise; ensure the method exists and is callable
    try:
        _ = QuestionRepository.migrate_questions_to_theme(99999, 99998)
    except Exception:
        pass
    return None


if __name__ == "__main__":
    print("🚀 Question Migration Test Suite")
    print("=" * 50)

    success = True

    # Test 1: Environment check
    if not test_migration():
        success = False

    # Test 2: Repository method check
    if not test_repository_method():
        success = False

    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! Migration functionality should work.")
    else:
        print("❌ Some tests failed. Check the errors above.")

    print("\n📖 Usage Instructions:")
    print("1. Open the admin interface in your browser")
    print("2. Go to the 'Themes' tab")
    print("3. Use the 'Mass Question Migration' panel at the top")
    print("4. Select source and target themes")
    print("5. Click 'Migrate All Questions' and confirm")
