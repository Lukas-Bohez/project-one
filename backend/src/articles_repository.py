from typing import Any, Dict, List, Optional

import config
import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool


class ArticlesRepository:
    """Repository class for managing articles in the database"""


# Module-level connection pool to avoid creating a new DB connection per call.
try:
    _pool = MySQLConnectionPool(
        pool_name="articles_pool", pool_size=5, **config.db_config
    )
except Exception:
    _pool = None

    # CREATE operations
    @staticmethod
    def create_article(
        title: str,
        author: str,
        date_written: str,
        story: str = None,
        content: str = "",
        excerpt: str = None,
        category: str = "general",
        tags: str = None,
        word_count: int = 0,
        reading_time_minutes: int = 0,
        is_active: bool = True,
        is_featured: bool = False,
    ):
        """Create a new article"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor()

            sql = """
            INSERT INTO articles (title, author, date_written, story, content, excerpt, 
                                category, tags, word_count, reading_time_minutes, is_active, is_featured)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            values = (
                title,
                author,
                date_written,
                story,
                content,
                excerpt,
                category,
                tags,
                word_count,
                reading_time_minutes,
                is_active,
                is_featured,
            )

            cursor.execute(sql, values)
            connection.commit()

            article_id = cursor.lastrowid
            print(f"✅ Article created successfully with ID: {article_id}")
            return article_id

        except mysql.connector.Error as e:
            print(f"❌ Error creating article: {e}")
            return None
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    # READ operations
    @staticmethod
    def get_all_articles(active_only: bool = False) -> List[Dict[str, Any]]:
        """Get all articles from the database"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            if active_only:
                sql = "SELECT * FROM articles WHERE is_active = TRUE ORDER BY created_at DESC"
            else:
                sql = "SELECT * FROM articles ORDER BY created_at DESC"

            cursor.execute(sql)
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving articles: {e}")
            return []
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def get_article_by_id(
        article_id: int, increment_view: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Get a single article by ID"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            sql = "SELECT * FROM articles WHERE id = %s"
            cursor.execute(sql, (article_id,))
            article = cursor.fetchone()

            if article and increment_view:
                # Increment view count only when requested by caller (e.g. an end-user request)
                cursor.execute(
                    "UPDATE articles SET view_count = view_count + 1 WHERE id = %s",
                    (article_id,),
                )
                connection.commit()

            return article

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving article by ID: {e}")
            return None
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def get_articles_by_author(
        author: str, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all articles by a specific author"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            if active_only:
                sql = "SELECT * FROM articles WHERE author = %s AND is_active = TRUE ORDER BY date_written DESC"
            else:
                sql = "SELECT * FROM articles WHERE author = %s ORDER BY date_written DESC"

            cursor.execute(sql, (author,))
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving articles by author: {e}")
            return []
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def get_articles_by_category(
        category: str, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all articles in a specific category"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            if active_only:
                sql = "SELECT * FROM articles WHERE category = %s AND is_active = TRUE ORDER BY date_written DESC"
            else:
                sql = "SELECT * FROM articles WHERE category = %s ORDER BY date_written DESC"

            cursor.execute(sql, (category,))
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving articles by category: {e}")
            return []
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def search_articles(
        search_term: str, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Search articles using full-text search"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            if active_only:
                sql = """
                SELECT *, MATCH(title, content, author, story) AGAINST(%s IN NATURAL LANGUAGE MODE) as relevance
                FROM articles 
                WHERE MATCH(title, content, author, story) AGAINST(%s IN NATURAL LANGUAGE MODE) 
                AND is_active = TRUE
                ORDER BY relevance DESC
                """
            else:
                sql = """
                SELECT *, MATCH(title, content, author, story) AGAINST(%s IN NATURAL LANGUAGE MODE) as relevance
                FROM articles 
                WHERE MATCH(title, content, author, story) AGAINST(%s IN NATURAL LANGUAGE MODE)
                ORDER BY relevance DESC
                """

            cursor.execute(sql, (search_term, search_term))
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error searching articles: {e}")
            # Fallback to LIKE search if full-text fails
            return ArticlesRepository._fallback_search(search_term, active_only)
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def _fallback_search(
        search_term: str, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Fallback search using LIKE when full-text search fails"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            # Escape LIKE metacharacters to avoid surprising patterns and limit accidental full-table matches.
            safe = (
                search_term.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            like_term = f"%{safe}%"

            if active_only:
                sql = """
                SELECT * FROM articles 
                WHERE (title LIKE %s OR content LIKE %s OR author LIKE %s OR story LIKE %s) 
                AND is_active = TRUE
                ORDER BY date_written DESC
                ESCAPE '\\'
                """
            else:
                sql = """
                SELECT * FROM articles 
                WHERE (title LIKE %s OR content LIKE %s OR author LIKE %s OR story LIKE %s)
                ORDER BY date_written DESC
                ESCAPE '\\'
                """

            cursor.execute(sql, (like_term, like_term, like_term, like_term))
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error in fallback search: {e}")
            return []
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def get_featured_articles(limit: int = 5) -> List[Dict[str, Any]]:
        """Get featured articles"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            sql = """
            SELECT * FROM articles 
            WHERE is_featured = TRUE AND is_active = TRUE 
            ORDER BY date_written DESC 
            LIMIT %s
            """

            cursor.execute(sql, (limit,))
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving featured articles: {e}")
            return []
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def get_recent_articles(
        limit: int = 10, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Get most recent articles"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor(dictionary=True)

            if active_only:
                sql = "SELECT * FROM articles WHERE is_active = TRUE ORDER BY created_at DESC LIMIT %s"
            else:
                sql = "SELECT * FROM articles ORDER BY created_at DESC LIMIT %s"

            cursor.execute(sql, (limit,))
            articles = cursor.fetchall()

            return articles if articles else []

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving recent articles: {e}")
            return []
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    # UPDATE operations
    @staticmethod
    def update_article(article_id: int, **kwargs) -> bool:
        """Update an article with provided fields"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor()

            # Build dynamic update query
            allowed_fields = [
                "title",
                "author",
                "date_written",
                "story",
                "content",
                "excerpt",
                "category",
                "tags",
                "word_count",
                "reading_time_minutes",
                "is_active",
                "is_featured",
            ]

            update_fields = []
            values = []

            for field, value in kwargs.items():
                if field in allowed_fields:
                    update_fields.append(f"{field} = %s")
                    values.append(value)

            if not update_fields:
                print("⚠️ No valid fields provided for update")
                return False

            # Add updated_at timestamp
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            values.append(article_id)

            sql = f"UPDATE articles SET {', '.join(update_fields)} WHERE id = %s"

            cursor.execute(sql, values)
            connection.commit()

            if cursor.rowcount > 0:
                print(f"✅ Article {article_id} updated successfully")
                return True
            else:
                print(f"⚠️ No article found with ID {article_id}")
                return False

        except mysql.connector.Error as e:
            print(f"❌ Error updating article: {e}")
            return False
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def set_article_active_status(article_id: int, is_active: bool) -> bool:
        """Set article active/inactive status"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor()

            sql = "UPDATE articles SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
            cursor.execute(sql, (is_active, article_id))
            connection.commit()

            if cursor.rowcount > 0:
                status = "activated" if is_active else "deactivated"
                print(f"✅ Article {article_id} {status} successfully")
                return True
            else:
                print(f"⚠️ No article found with ID {article_id}")
                return False

        except mysql.connector.Error as e:
            print(f"❌ Error updating article status: {e}")
            return False
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    @staticmethod
    def set_article_featured_status(article_id: int, is_featured: bool) -> bool:
        """Set article featured status"""
        try:
            connection = (
                _pool.get_connection()
                if _pool
                else mysql.connector.connect(**config.db_config)
            )
            cursor = connection.cursor()

            sql = "UPDATE articles SET is_featured = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
            cursor.execute(sql, (is_featured, article_id))
            connection.commit()

            if cursor.rowcount > 0:
                status = "featured" if is_featured else "unfeatured"
                print(f"✅ Article {article_id} {status} successfully")
                return True
            else:
                print(f"⚠️ No article found with ID {article_id}")
                return False

        except mysql.connector.Error as e:
            print(f"❌ Error updating article featured status: {e}")
            return False
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    # DELETE operations
    @staticmethod
    def delete_article(article_id: int) -> bool:
        """Delete an article from the database"""
        try:
            connection = mysql.connector.connect(**config.db_config)
            cursor = connection.cursor()

            # First check if article exists
            cursor.execute("SELECT title FROM articles WHERE id = %s", (article_id,))
            article = cursor.fetchone()

            if not article:
                print(f"⚠️ No article found with ID {article_id}")
                return False

            # Delete the article
            sql = "DELETE FROM articles WHERE id = %s"
            cursor.execute(sql, (article_id,))
            connection.commit()

            if cursor.rowcount > 0:
                print(f"✅ Article {article_id} ('{article[0]}') deleted successfully")
                return True
            else:
                print(f"❌ Failed to delete article {article_id}")
                return False

        except mysql.connector.Error as e:
            print(f"❌ Error deleting article: {e}")
            return False
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()

    # STATISTICS operations
    @staticmethod
    def get_articles_stats() -> Dict[str, Any]:
        """Get articles statistics"""
        try:
            connection = mysql.connector.connect(**config.db_config)
            cursor = connection.cursor(dictionary=True)

            stats = {}

            # Total articles
            cursor.execute("SELECT COUNT(*) as total FROM articles")
            stats["total_articles"] = cursor.fetchone()["total"]

            # Active articles
            cursor.execute(
                "SELECT COUNT(*) as active FROM articles WHERE is_active = TRUE"
            )
            stats["active_articles"] = cursor.fetchone()["active"]

            # Featured articles
            cursor.execute(
                "SELECT COUNT(*) as featured FROM articles WHERE is_featured = TRUE"
            )
            stats["featured_articles"] = cursor.fetchone()["featured"]

            # Articles by category
            cursor.execute("""
                SELECT category, COUNT(*) as count 
                FROM articles 
                WHERE is_active = TRUE 
                GROUP BY category 
                ORDER BY count DESC
            """)
            stats["by_category"] = cursor.fetchall()

            # Top authors
            cursor.execute("""
                SELECT author, COUNT(*) as count 
                FROM articles 
                WHERE is_active = TRUE 
                GROUP BY author 
                ORDER BY count DESC 
                LIMIT 5
            """)
            stats["top_authors"] = cursor.fetchall()

            # Most viewed articles
            cursor.execute("""
                SELECT id, title, view_count 
                FROM articles 
                WHERE is_active = TRUE 
                ORDER BY view_count DESC 
                LIMIT 5
            """)
            stats["most_viewed"] = cursor.fetchall()

            return stats

        except mysql.connector.Error as e:
            print(f"❌ Error retrieving statistics: {e}")
            return {}
        finally:
            if "cursor" in locals() and cursor:
                cursor.close()
            if "connection" in locals() and connection:
                connection.close()


# Test functions
def test_articles_repository():
    """Test the ArticlesRepository functionality"""
    print("🧪 Testing ArticlesRepository...")
    print("=" * 60)

    # Test creating an article
    print("\n1. Testing article creation...")
    article_id = ArticlesRepository.create_article(
        title="Test Article",
        author="Test Author",
        date_written="2024-09-27",
        story="This is a test story",
        content="This is test content for our article repository.",
        category="test",
        tags="test, repository, article",
        word_count=50,
        reading_time_minutes=1,
    )

    if article_id:
        print(f"✅ Created test article with ID: {article_id}")

        # Test retrieving the article
        print("\n2. Testing article retrieval...")
        article = ArticlesRepository.get_article_by_id(article_id, increment_view=True)
        if article:
            print(f"✅ Retrieved article: {article['title']}")

        # Test updating the article
        print("\n3. Testing article update...")
        success = ArticlesRepository.update_article(
            article_id,
            title="Updated Test Article",
            content="This is updated test content.",
        )
        if success:
            print("✅ Article updated successfully")

        # Test search
        print("\n4. Testing article search...")
        search_results = ArticlesRepository.search_articles("test")
        print(f"✅ Found {len(search_results)} articles matching 'test'")

        # Clean up - delete test article
        print("\n5. Cleaning up...")
        ArticlesRepository.delete_article(article_id)

    # Test statistics
    print("\n6. Testing statistics...")
    stats = ArticlesRepository.get_articles_stats()
    print(f"✅ Database contains {stats.get('total_articles', 0)} total articles")
    print(f"✅ {stats.get('active_articles', 0)} are active")

    print("\n🏁 Repository testing completed!")


if __name__ == "__main__":
    print("📚 ARTICLES REPOSITORY")
    print("=" * 60)

    # Run tests
    test_articles_repository()

    print("\n" + "=" * 60)
    print("ArticlesRepository is ready to use! 🚀")
