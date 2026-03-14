import config
import mysql.connector


def check_user_permissions():
    """Check what permissions the current user has"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print("🔍 CHECKING DATABASE USER PERMISSIONS")
        print("=" * 60)

        # Get current user info
        cursor.execute("SELECT USER(), CURRENT_USER()")
        user_info = cursor.fetchone()
        print(f"Connected as: {user_info[0]}")
        print(f"Current user: {user_info[1]}")

        # Check grants for current user
        print("\n📋 Checking grants for user...")
        try:
            cursor.execute("SHOW GRANTS FOR CURRENT_USER()")
            grants = cursor.fetchall()

            print("Current user grants:")
            for grant in grants:
                print(f"  - {grant[0]}")

        except mysql.connector.Error as e:
            print(f"❌ Error checking grants: {e}")

        # Check what tables exist
        print(f"\n📊 Existing tables in database:")
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()

        if tables:
            print("Found tables:")
            for table in tables:
                print(f"  - {table[0]}")
        else:
            print("No tables found in database")

        # Try a simple CREATE TABLE test
        print(f"\n🧪 Testing CREATE TABLE permissions...")
        try:
            test_sql = """
            CREATE TABLE IF NOT EXISTS test_permissions_check (
                id INT AUTO_INCREMENT PRIMARY KEY,
                test_field VARCHAR(50)
            )
            """
            cursor.execute(test_sql)
            print("✅ CREATE TABLE test successful!")

            # Clean up test table
            cursor.execute("DROP TABLE IF EXISTS test_permissions_check")
            print("✅ Test table cleaned up")

        except mysql.connector.Error as e:
            print(f"❌ CREATE TABLE test failed: {e}")

        # Check database name and config
        print(f"\n⚙️ Database configuration:")
        cursor.execute("SELECT DATABASE()")
        current_db = cursor.fetchone()[0]
        print(f"Current database: {current_db}")
        print(f"Config database: {config.db_config.get('database', 'NOT SET')}")

        if current_db != config.db_config.get("database"):
            print("⚠️ WARNING: Connected to different database than configured!")

    except mysql.connector.Error as e:
        print(f"❌ Error checking permissions: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


def try_create_articles_table_simple():
    """Try creating articles table with minimal structure first"""
    try:
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print("\n🔧 TRYING SIMPLE ARTICLE TABLE CREATION")
        print("=" * 60)

        # Try very basic table first
        simple_sql = """
        CREATE TABLE IF NOT EXISTS articles_simple (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            content TEXT NOT NULL
        )
        """

        cursor.execute(simple_sql)
        connection.commit()
        print("✅ Simple articles table created successfully!")

        # Drop it
        cursor.execute("DROP TABLE articles_simple")
        connection.commit()
        print("✅ Simple table cleaned up")

        # Now try the full table
        print("\n🚀 Trying full articles table...")

        full_sql = """
        CREATE TABLE IF NOT EXISTS articles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            author VARCHAR(200) NOT NULL,
            date_written DATE NOT NULL,
            story TEXT,
            content LONGTEXT NOT NULL,
            excerpt TEXT,
            category VARCHAR(100) DEFAULT 'general',
            tags VARCHAR(500),
            word_count INT DEFAULT 0,
            reading_time_minutes INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            is_featured BOOLEAN DEFAULT FALSE,
            view_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """

        cursor.execute(full_sql)
        connection.commit()
        print("✅ Full articles table created successfully!")

        # Add indexes separately
        print("🔧 Adding indexes...")

        indexes = [
            "CREATE INDEX idx_author ON articles (author)",
            "CREATE INDEX idx_date_written ON articles (date_written)",
            "CREATE INDEX idx_category ON articles (category)",
            "CREATE INDEX idx_active ON articles (is_active)",
            "CREATE INDEX idx_featured ON articles (is_featured)",
        ]

        for index_sql in indexes:
            try:
                cursor.execute(index_sql)
                print(f"✅ Index added: {index_sql.split()[-1]}")
            except mysql.connector.Error as e:
                if "Duplicate key name" in str(e):
                    print(f"⚠️ Index already exists: {index_sql.split()[-1]}")
                else:
                    print(f"❌ Failed to add index: {e}")

        # Try FULLTEXT separately
        print("🔧 Adding FULLTEXT index...")
        try:
            cursor.execute(
                "ALTER TABLE articles ADD FULLTEXT KEY ft_search (title, content, author, story)"
            )
            print("✅ FULLTEXT index added successfully!")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("⚠️ FULLTEXT index already exists")
            else:
                print(f"❌ Failed to add FULLTEXT index: {e}")

        connection.commit()

        # Verify table
        cursor.execute("DESCRIBE articles")
        columns = cursor.fetchall()
        print(f"\n📋 Table structure verified - {len(columns)} columns created")

    except mysql.connector.Error as e:
        print(f"❌ Error in simple creation: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


if __name__ == "__main__":
    # First check permissions
    check_user_permissions()

    # Then try creating the table
    try_create_articles_table_simple()

    print("\n🏁 Diagnostic completed!")
