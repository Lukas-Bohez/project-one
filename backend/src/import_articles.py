#!/usr/bin/env python3
"""
Article Import Script
Imports articles from frontend/js/content.js into the database
Author: Oroka Conner
Date Range: 2025-08-01 to 2025-09-15
"""

import json
import os
import re
import sys
from datetime import datetime, timedelta
from typing import Any, Dict, List

# Add the backend directory to the path to import database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database.datarepository import ArticlesRepository, StoriesRepository


def extract_articles_from_js(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract articles from the content.js file
    """
    print(f"Reading articles from {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the contentArticles array - look for the start and end more carefully
    start_match = re.search(r"const\s+contentArticles\s*=\s*\[", content)
    if not start_match:
        raise ValueError("Could not find contentArticles array start in the file")

    start_pos = start_match.end() - 1  # Include the opening bracket

    # Find the closing bracket by counting brackets
    bracket_count = 0
    end_pos = start_pos

    for i, char in enumerate(content[start_pos:], start_pos):
        if char == "[":
            bracket_count += 1
        elif char == "]":
            bracket_count -= 1
            if bracket_count == 0:
                end_pos = i + 1
                break

    if bracket_count != 0:
        raise ValueError(
            "Could not find matching closing bracket for contentArticles array"
        )

    # Extract the array content
    articles_str = content[start_pos:end_pos]

    # Clean up JavaScript syntax for JSON parsing
    # Remove trailing commas before closing brackets/braces
    articles_str = re.sub(r",(\s*[}\]])", r"\1", articles_str)

    try:
        # Parse the JavaScript array as JSON
        articles = json.loads(articles_str)
        print(f"Successfully parsed {len(articles)} articles")
        return articles
    except json.JSONDecodeError as e:
        print(f"Error parsing articles JSON: {e}")
        # Save the problematic content to a file for debugging
        with open("/tmp/debug_articles.json", "w") as f:
            f.write(articles_str)
        print("Saved problematic content to /tmp/debug_articles.json for debugging")
        raise


def calculate_word_count(content_obj: Dict[str, Any]) -> int:
    """
    Calculate word count from article content structure
    """
    word_count = 0

    # Count words in intro
    if "intro" in content_obj and content_obj["intro"]:
        word_count += len(content_obj["intro"].split())

    # Count words in highlights
    if "highlights" in content_obj:
        for highlight in content_obj["highlights"]:
            if isinstance(highlight, dict):
                if "title" in highlight:
                    word_count += len(highlight["title"].split())
                if "content" in highlight:
                    word_count += len(highlight["content"].split())
            elif isinstance(highlight, str):
                word_count += len(highlight.split())

    # Count words in cards
    if "cards" in content_obj:
        for card in content_obj["cards"]:
            if "title" in card:
                word_count += len(card["title"].split())
            if "content" in card:
                word_count += len(card["content"].split())
            if "list" in card and isinstance(card["list"], list):
                for item in card["list"]:
                    word_count += len(item.split())

    # Count words in sections
    if "sections" in content_obj:
        for section in content_obj["sections"]:
            if "title" in section:
                word_count += len(section["title"].split())
            if "content" in section:
                word_count += len(section["content"].split())
            if "list" in section and isinstance(section["list"], list):
                for item in section["list"]:
                    word_count += len(item.split())

    return word_count


def generate_excerpt(content_obj: Dict[str, Any]) -> str:
    """
    Generate an excerpt from the article content
    """
    # Use intro if available
    if "intro" in content_obj and content_obj["intro"]:
        intro = content_obj["intro"]
        # Limit to first 200 characters
        if len(intro) > 200:
            return intro[:200] + "..."
        return intro

    # Fall back to first highlight content
    if "highlights" in content_obj and content_obj["highlights"]:
        first_highlight = content_obj["highlights"][0]
        if isinstance(first_highlight, dict) and "content" in first_highlight:
            content = first_highlight["content"]
            if len(content) > 200:
                return content[:200] + "..."
            return content

    return "No excerpt available"


def generate_dates(start_date: str, end_date: str, num_articles: int) -> List[str]:
    """
    Generate evenly distributed dates between start and end date
    """
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    # Calculate total days
    total_days = (end - start).days + 1

    dates = []
    for i in range(num_articles):
        # Distribute articles evenly across the date range
        day_offset = (i * total_days) // num_articles
        article_date = start + timedelta(days=day_offset)
        dates.append(article_date.strftime("%Y-%m-%d"))

    return dates


def get_story_mapping(article_index: int) -> tuple[str, int]:
    """
    Get story name and story_order based on article index (0-based)
    Returns (story_name, story_order)
    """
    # Convert to 1-based index for matching ranges
    article_num = article_index + 1

    if 1 <= article_num <= 2:
        return ("Quiz the Spire", article_num - 1)  # 0-1
    elif 3 <= article_num <= 11:
        return ("Toxic Air", article_num - 3)  # 0-8
    elif 12 <= article_num <= 21:
        return ("Ash Bloods", article_num - 12)  # 0-9
    elif 22 <= article_num <= 34:
        return ("The Meat Clock", article_num - 22)  # 0-12
    elif 35 <= article_num <= 78:
        return ("Age of Bargaining, Part 1: Malrec", article_num - 35)  # 0-43
    elif 79 <= article_num <= 85:
        return (
            "Age of Bargaining, Part 2: Tournament of Time",
            article_num - 79,
        )  # 0-6
    else:
        # Fallback for any articles beyond expected range
        return ("Miscellaneous", 0)


def ensure_story_exists(story_name: str) -> int:
    """
    Ensure a story exists in the database, create if it doesn't
    Returns the story ID
    """
    # Check if story already exists
    existing_story = StoriesRepository.get_story_by_name(story_name)
    if existing_story:
        return existing_story["id"]

    # Create new story
    # Generate a slug from the name
    slug = story_name.lower().replace(" ", "-").replace(",", "").replace(":", "")

    # Add description based on story name
    descriptions = {
        "Quiz the Spire": "The foundational story introducing the world of Quiz the Spire",
        "Toxic Air": "A tale of environmental danger and survival",
        "Ash Bloods": "The story of those marked by ash and their struggle",
        "The Meat Clock": "A dark chronicle of time and flesh",
        "Age of Bargaining, Part 1: Malrec": "The first part of the great bargaining age, focusing on Malrec's journey",
        "Age of Bargaining, Part 2: Tournament of Time": "The climactic tournament that decides the fate of time itself",
    }

    description = descriptions.get(story_name, f"Stories from {story_name}")

    story_id = StoriesRepository.create_story(
        name=story_name, slug=slug, description=description
    )

    if story_id:
        print(f"Created new story: {story_name} (ID: {story_id})")
        return story_id
    else:
        raise ValueError(f"Failed to create story: {story_name}")


def format_article_for_db(
    article: Dict[str, Any], date_written: str, article_index: int
) -> Dict[str, Any]:
    """
    Format an article for database insertion with story mapping
    """
    # Create content object with the required structure
    content_obj = {
        "intro": article.get("intro", ""),
        "highlights": article.get("highlights", []),
        "cards": article.get("cards", []),
        "sections": article.get("sections", []),
    }

    word_count = calculate_word_count(content_obj)
    reading_time = max(1, word_count // 200)  # Assume 200 words per minute
    excerpt = generate_excerpt(content_obj)

    # Determine category based on content
    title_lower = article.get("title", "").lower()
    if any(word in title_lower for word in ["privacy", "policy", "terms", "legal"]):
        category = "legal"
    elif any(word in title_lower for word in ["tutorial", "guide", "how to"]):
        category = "tutorial"
    elif any(word in title_lower for word in ["news", "update", "announcement"]):
        category = "news"
    elif any(word in title_lower for word in ["review", "analysis"]):
        category = "review"
    else:
        category = "general"

    # Get story mapping
    story_name, story_order = get_story_mapping(article_index)
    story_id = ensure_story_exists(story_name)

    return {
        "title": article.get("title", "Untitled"),
        "author": "Oroka Conner",
        "date_written": date_written,
        "story": story_name,  # Keep legacy field for backward compatibility
        "story_id": story_id,
        "story_order": story_order,
        "content": json.dumps(content_obj),
        "excerpt": excerpt,
        "category": category,
        "tags": f"quiz-the-spire,gaming,{category}",
        "word_count": word_count,
        "reading_time_minutes": reading_time,
        "is_active": True,
        "is_featured": False,
    }


def import_articles_to_db(articles: List[Dict[str, Any]]):
    """
    Import articles to the database using ArticlesRepository
    """
    # Generate dates
    dates = generate_dates("2025-08-01", "2025-09-15", len(articles))

    print(f"Importing {len(articles)} articles...")
    print("Story mapping preview:")
    for i in range(min(10, len(articles))):
        story_name, story_order = get_story_mapping(i)
        print(f"  Article {i+1}: {story_name} (order {story_order})")
    if len(articles) > 10:
        print("  ...")

    imported_count = 0
    failed_count = 0
    stories_created = set()

    for i, article in enumerate(articles):
        try:
            formatted_article = format_article_for_db(article, dates[i], i)

            # Track stories created
            story_name = formatted_article["story"]
            if story_name not in stories_created:
                stories_created.add(story_name)

            # Use ArticlesRepository for insertion with new fields
            result = ArticlesRepository.create_article(
                title=formatted_article["title"],
                author=formatted_article["author"],
                date_written=formatted_article["date_written"],
                story=formatted_article["story"],
                story_id=formatted_article["story_id"],
                story_order=formatted_article["story_order"],
                content=formatted_article["content"],
                excerpt=formatted_article["excerpt"],
                category=formatted_article["category"],
                tags=formatted_article["tags"],
                word_count=formatted_article["word_count"],
                reading_time_minutes=formatted_article["reading_time_minutes"],
                is_active=formatted_article["is_active"],
                is_featured=formatted_article["is_featured"],
            )

            if result:
                imported_count += 1

                if imported_count % 10 == 0:
                    print(f"Imported {imported_count} articles...")
            else:
                failed_count += 1
                print(f"Failed to import article: {formatted_article['title']}")

        except Exception as e:
            failed_count += 1
            print(f"Error importing article {i+1}: {e}")
            print(f"Article title: {article.get('title', 'Unknown')}")
            continue

    print(f"\nImport completed!")
    print(f"Successfully imported: {imported_count} articles")
    print(f"Failed imports: {failed_count} articles")
    print(f"Stories created/used: {', '.join(sorted(stories_created))}")


def main():
    """
    Main import function
    """
    # Path to the content.js file
    content_js_path = "/home/student/Project/project-one/frontend/js/content.js"

    if not os.path.exists(content_js_path):
        print(f"Error: Content file not found at {content_js_path}")
        return

    try:
        # Extract articles from content.js
        articles = extract_articles_from_js(content_js_path)

        if not articles:
            print("No articles found in content.js")
            return

        # Ask for confirmation
        response = input(
            f"Found {len(articles)} articles. Import them to the database? (y/N): "
        )
        if response.lower() != "y":
            print("Import cancelled.")
            return

        # Import to database
        import_articles_to_db(articles)

    except Exception as e:
        print(f"Error during import: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
