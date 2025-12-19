import mysql.connector

def create_articles_table_as_admin():
    """Create articles table using admin credentials"""
    
    # You'll need to update these with your admin/root credentials
    admin_config = {
        'user': 'root',  # Change this to your admin username
        'password': 'your_admin_password',  # Change this to your admin password
        'host': '127.0.0.1',
        'port': 3306,
        'database': 'quizTheSpire',
        'charset': 'utf8mb4',
        'collation': 'utf8mb4_unicode_ci',
        'raise_on_warnings': True
    }
    
    try:
        print("🔐 Connecting as database administrator...")
        print("=" * 60)
        
        # Connect with admin credentials
        connection = mysql.connector.connect(**admin_config)
        cursor = connection.cursor()
        
        print("✅ Connected successfully as admin user")
        
        # Check if articles table already exists
        cursor.execute("SHOW TABLES LIKE 'articles'")
        if cursor.fetchone():
            print("⚠️ Articles table already exists!")
            return
        
        # Create the articles table
        create_sql = """
        CREATE TABLE articles (
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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_author (author),
            INDEX idx_date_written (date_written),
            INDEX idx_category (category),
            INDEX idx_active (is_active),
            INDEX idx_featured (is_featured),
            FULLTEXT KEY ft_search (title, content, author, story)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
        
        cursor.execute(create_sql)
        connection.commit()
        print("✅ Articles table created successfully!")
        
        # Optional: Grant permissions on the new table to quiz_user
        try:
            cursor.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON quizTheSpire.articles TO 'quiz_user'@'localhost'")
            cursor.execute("FLUSH PRIVILEGES")
            connection.commit()
            print("✅ Granted permissions to quiz_user on articles table")
        except mysql.connector.Error as e:
            print(f"⚠️ Could not grant permissions to quiz_user: {e}")
        
        # Verify table creation
        cursor.execute("DESCRIBE articles")
        columns = cursor.fetchall()
        print(f"✅ Table verified - {len(columns)} columns created")
        
    except mysql.connector.Error as e:
        print(f"❌ Error: {e}")
        print("\n💡 Troubleshooting tips:")
        print("   1. Make sure you have the correct admin username/password")
        print("   2. Verify the admin user has CREATE privileges")
        print("   3. Check if MySQL server is running and accessible")
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'connection' in locals() and connection:
            connection.close()

if __name__ == "__main__":
    print("🔧 ARTICLES TABLE CREATION (ADMIN MODE)")
    print("=" * 60)
    print("⚠️  BEFORE RUNNING: Update admin_config with your admin credentials!")
    print("=" * 60)
    
    # Uncomment the line below after updating admin credentials
    # create_articles_table_as_admin()
    
    print("\n📝 Instructions:")
    print("1. Edit this file and update admin_config with your admin/root credentials")
    print("2. Uncomment the create_articles_table_as_admin() call")
    print("3. Run this script again")
    print("\nAlternatively, run this SQL as admin in MySQL:")
    print("GRANT CREATE ON quizTheSpire.* TO 'quiz_user'@'localhost';")
    print("FLUSH PRIVILEGES;")