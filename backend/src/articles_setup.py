import config
import mysql.connector


def create_articles_table():
    """Create the articles table in the database"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print("🚀 Creating articles table...")
        print("=" * 60)

        # Check if table already exists
        cursor.execute("SHOW TABLES LIKE 'articles'")
        table_exists = cursor.fetchone()

        if table_exists:
            print("⚠️ Articles table already exists, skipping creation")
            return True

        # Create articles table
        create_table_sql = """
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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_author (author),
            INDEX idx_date_written (date_written),
            INDEX idx_category (category),
            INDEX idx_active (is_active),
            INDEX idx_featured (is_featured),
            FULLTEXT KEY ft_search (title, content, author, story)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """

        cursor.execute(create_table_sql)
        print("✅ Articles table created successfully!")

        # Commit the changes
        connection.commit()

        # Verify table creation
        cursor.execute("SHOW TABLES LIKE 'articles'")
        table_exists = cursor.fetchone()

        if table_exists:
            print("✅ Table verification successful!")

            # Show table structure
            cursor.execute("DESCRIBE articles")
            columns = cursor.fetchall()

            print("\n📋 Table structure:")
            print("-" * 60)
            for column in columns:
                field, type_info, null, key, default, extra = column
                print(f"  {field:<20} | {type_info:<20} | {key:<5} | {null}")

            return True
        else:
            print("❌ Table verification failed!")
            return False

    except mysql.connector.Error as e:
        print(f"❌ Error creating articles table: {e}")
        return False
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


def add_sample_articles():
    """Add some sample articles to the table"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        # Check if table exists first
        cursor.execute("SHOW TABLES LIKE 'articles'")
        table_exists = cursor.fetchone()

        if not table_exists:
            print("❌ Articles table does not exist! Please create it first.")
            return

        print("\n📝 Adding sample articles...")
        print("-" * 60)

        # Sample articles data - properly formatted JSON articles
        sample_articles = [
            {
                "title": "Getting Started with Web Development",
                "author": "Tech Writer",
                "date_written": "2024-01-15",
                "story": "sample articles",
                "content": """{
    "title": "Getting Started with Web Development",
    "intro": "Web development is an exciting field that combines creativity with technical skills. This comprehensive guide will explore the fundamentals of building websites and web applications, from basic HTML to modern frameworks.",
    "highlights": [
        {
            "title": "Frontend Fundamentals",
            "content": "Master HTML, CSS, and JavaScript - the core technologies that power every website and web application you see today."
        },
        {
            "title": "Modern Development Tools",
            "content": "Learn about version control, code editors, and development frameworks that streamline the web development process."
        },
        {
            "title": "Career Opportunities",
            "content": "Discover the diverse career paths available in web development, from frontend specialist to full-stack developer."
        }
    ],
    "cards": [
        {
            "title": "HTML & CSS Basics",
            "content": "Build your foundation with these essential web technologies:",
            "list": [
                "Semantic HTML structure and accessibility principles",
                "CSS styling, layouts, and responsive design techniques",
                "Modern CSS features like Grid and Flexbox",
                "Best practices for clean, maintainable code"
            ]
        },
        {
            "title": "JavaScript Essentials",
            "content": "Add interactivity and dynamic behavior to your websites:",
            "list": [
                "Core JavaScript syntax and programming concepts",
                "DOM manipulation and event handling",
                "Asynchronous programming with promises and async/await",
                "Popular libraries and frameworks like React or Vue"
            ]
        },
        {
            "title": "Development Environment",
            "content": "Set up your workspace for efficient coding:",
            "list": [
                "Choose the right code editor (VS Code, Sublime, etc.)",
                "Version control with Git and GitHub",
                "Package managers and build tools",
                "Browser developer tools for debugging"
            ]
        }
    ],
    "sections": [
        {
            "title": "Learning Path",
            "content": "Follow this structured approach to master web development:",
            "list": [
                "Start with HTML and CSS fundamentals",
                "Add JavaScript for interactive features",
                "Learn a modern framework or library",
                "Practice with real projects and build a portfolio",
                "Explore backend technologies for full-stack development"
            ]
        }
    ]
}""",
                "excerpt": "Learn the basics of web development from HTML to modern frameworks",
                "category": "technology",
                "tags": "web development, programming, beginner",
                "word_count": 250,
                "reading_time_minutes": 3,
            },
            {
                "title": "The Future of AI in Education",
                "author": "Dr. Sarah Johnson",
                "date_written": "2024-02-20",
                "story": "sample articles",
                "content": """{
    "title": "The Future of AI in Education",
    "intro": "Artificial Intelligence is revolutionizing the educational landscape. From personalized learning experiences to automated grading systems, AI is making education more accessible, effective, and tailored to individual needs.",
    "highlights": [
        {
            "title": "Personalized Learning",
            "content": "AI algorithms adapt to individual learning styles, pace, and preferences, creating customized educational experiences for every student."
        },
        {
            "title": "Intelligent Tutoring",
            "content": "AI-powered tutoring systems provide 24/7 support, instant feedback, and adaptive questioning to help students master complex concepts."
        },
        {
            "title": "Accessibility Improvements",
            "content": "AI breaks down barriers to education through real-time translation, speech-to-text, and adaptive interfaces for students with disabilities."
        }
    ],
    "cards": [
        {
            "title": "Current AI Applications",
            "content": "AI is already transforming education through:",
            "list": [
                "Adaptive learning platforms that adjust difficulty in real-time",
                "Automated essay grading and feedback systems",
                "Intelligent chatbots for student support",
                "Predictive analytics for identifying at-risk students"
            ]
        },
        {
            "title": "Benefits for Educators",
            "content": "AI empowers teachers with powerful tools:",
            "list": [
                "Automated administrative tasks and grading",
                "Data-driven insights into student performance",
                "Personalized lesson plan recommendations",
                "Early intervention alerts for struggling students"
            ]
        },
        {
            "title": "Student Advantages",
            "content": "Students benefit from AI-enhanced learning:",
            "list": [
                "Customized learning paths based on individual needs",
                "Immediate feedback and progress tracking",
                "Access to AI tutors available 24/7",
                "Gamified learning experiences that increase engagement"
            ]
        }
    ],
    "sections": [
        {
            "title": "Ethical Considerations",
            "content": "Important factors to consider as AI advances in education:",
            "list": [
                "Protecting student privacy and data security",
                "Ensuring AI systems are free from bias",
                "Maintaining human connection in learning",
                "Preparing students for an AI-driven future workforce"
            ]
        }
    ]
}""",
                "excerpt": "Discover how AI is changing the way we learn and teach",
                "category": "education",
                "tags": "AI, machine learning, education, technology",
                "word_count": 400,
                "reading_time_minutes": 5,
            },
            {
                "title": "Sustainable Living Tips",
                "author": "Green Living Expert",
                "date_written": "2024-03-10",
                "story": "sample articles",
                "content": """{
    "title": "Sustainable Living Tips",
    "intro": "Living sustainably doesn't have to be complicated or expensive. These practical tips will help you reduce your environmental impact while often saving money and improving your quality of life.",
    "highlights": [
        {
            "title": "Energy Efficiency",
            "content": "Simple changes to your energy consumption can significantly reduce your carbon footprint and utility bills."
        },
        {
            "title": "Waste Reduction",
            "content": "Minimize waste through smart purchasing decisions, reusing items creatively, and proper recycling practices."
        },
        {
            "title": "Sustainable Transportation",
            "content": "Choose eco-friendly transportation options that reduce emissions while keeping you active and healthy."
        }
    ],
    "cards": [
        {
            "title": "Home Energy Savings",
            "content": "Reduce your energy consumption with these simple changes:",
            "list": [
                "Switch to LED light bulbs and smart thermostats",
                "Unplug electronics when not in use",
                "Use natural light and ventilation when possible",
                "Invest in energy-efficient appliances"
            ]
        },
        {
            "title": "Waste Reduction Strategies",
            "content": "Minimize your environmental impact through waste reduction:",
            "list": [
                "Buy only what you need and choose quality over quantity",
                "Repurpose containers and packaging materials",
                "Compost organic waste for nutrient-rich soil",
                "Choose products with minimal packaging"
            ]
        },
        {
            "title": "Eco-Friendly Transportation",
            "content": "Reduce transportation emissions with these alternatives:",
            "list": [
                "Walk, bike, or use public transportation when possible",
                "Carpool or use ride-sharing for longer trips",
                "Work from home when your job allows it",
                "Combine errands into single trips"
            ]
        }
    ],
    "sections": [
        {
            "title": "Getting Started",
            "content": "Begin your sustainable living journey with these easy first steps:",
            "list": [
                "Start with one or two changes and build momentum",
                "Track your progress and celebrate small wins",
                "Share tips with family and friends",
                "Research local sustainability programs and resources"
            ]
        }
    ]
}""",
                "excerpt": "Simple and practical tips for a more sustainable lifestyle",
                "category": "lifestyle",
                "tags": "sustainability, environment, green living",
                "word_count": 300,
                "reading_time_minutes": 4,
            },
            {
                "title": "The Art of Coffee Brewing",
                "author": "Coffee Connoisseur",
                "date_written": "2024-04-05",
                "story": "sample articles",
                "content": """{
    "title": "The Art of Coffee Brewing",
    "intro": "Coffee is more than just a morning ritual - it's an art form. This comprehensive guide explores different brewing methods and techniques to help you create the perfect cup at home.",
    "highlights": [
        {
            "title": "Brewing Methods",
            "content": "Discover various brewing techniques from French press to pour-over, each offering unique flavors and experiences."
        },
        {
            "title": "Coffee Bean Selection",
            "content": "Learn about different coffee origins, roast levels, and how to choose beans that match your taste preferences."
        },
        {
            "title": "Perfect Extraction",
            "content": "Master the variables of grind size, water temperature, and brewing time to extract the best flavors from your coffee."
        }
    ],
    "cards": [
        {
            "title": "Essential Equipment",
            "content": "Build your home coffee brewing setup with these essentials:",
            "list": [
                "Quality coffee grinder for fresh, consistent grounds",
                "Digital scale for precise measurements",
                "Temperature-controlled kettle for optimal water heat",
                "Your preferred brewing device (French press, V60, etc.)"
            ]
        },
        {
            "title": "Brewing Techniques",
            "content": "Master these popular brewing methods:",
            "list": [
                "French Press: Full-bodied coffee with rich oils",
                "Pour-Over (V60/Chemex): Clean, bright flavors",
                "Espresso: Concentrated, intense coffee experience",
                "Cold Brew: Smooth, low-acid summer refreshment"
            ]
        },
        {
            "title": "Coffee Variables",
            "content": "Control these factors for consistent results:",
            "list": [
                "Grind size: Coarse for French press, fine for espresso",
                "Water temperature: 195-205°F for most brewing methods",
                "Coffee-to-water ratio: Start with 1:15 to 1:17",
                "Brewing time: Varies by method, typically 4-6 minutes"
            ]
        }
    ],
    "sections": [
        {
            "title": "Coffee Journey",
            "content": "Develop your coffee skills with this progression:",
            "list": [
                "Start with pre-ground coffee and basic equipment",
                "Invest in a good grinder for fresh grounds",
                "Experiment with different brewing methods",
                "Try single-origin coffees to understand flavor profiles",
                "Fine-tune your technique based on taste preferences"
            ]
        }
    ]
}""",
                "excerpt": "Transform your morning routine with professional coffee brewing techniques",
                "category": "food",
                "tags": "coffee, brewing, beverages, lifestyle",
                "word_count": 350,
                "reading_time_minutes": 4,
            },
        ]

        # Insert sample articles
        insert_sql = """
        INSERT INTO articles (title, author, date_written, story, content, excerpt, category, tags, word_count, reading_time_minutes)
        VALUES (%(title)s, %(author)s, %(date_written)s, %(story)s, %(content)s, %(excerpt)s, %(category)s, %(tags)s, %(word_count)s, %(reading_time_minutes)s)
        """

        inserted_count = 0
        for article in sample_articles:
            try:
                cursor.execute(insert_sql, article)
                inserted_count += 1
                print(f"✅ Added: '{article['title']}'")
            except mysql.connector.Error as e:
                print(f"❌ Failed to add '{article['title']}': {e}")

        # Commit the changes
        connection.commit()

        print("\n📊 Summary:")
        print(f"   Sample articles inserted: {inserted_count}/{len(sample_articles)}")

        # Verify insertion
        cursor.execute("SELECT COUNT(*) FROM articles")
        total_articles = cursor.fetchone()[0]
        print(f"   Total articles in database: {total_articles}")

    except mysql.connector.Error as e:
        print(f"❌ Error adding sample articles: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


def show_articles_summary():
    """Display a summary of articles in the database"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print("\n📚 Articles Database Summary")
        print("=" * 60)

        # Get total count
        cursor.execute("SELECT COUNT(*) FROM articles")
        total_count = cursor.fetchone()[0]
        print(f"Total articles: {total_count}")

        # Get articles by category
        cursor.execute("""
            SELECT category, COUNT(*) as count 
            FROM articles 
            GROUP BY category 
            ORDER BY count DESC
        """)
        categories = cursor.fetchall()

        print("\nArticles by category:")
        for category, count in categories:
            print(f"  {category}: {count}")

        # Show recent articles
        cursor.execute("""
            SELECT id, title, author, date_written, category
            FROM articles 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        recent_articles = cursor.fetchall()

        print("\nRecent articles:")
        print("-" * 60)
        for article_id, title, author, date_written, category in recent_articles:
            print(
                f"ID {article_id:3}: {title[:40]:<40} | {author[:15]:<15} | {category}"
            )

    except mysql.connector.Error as e:
        print(f"❌ Error retrieving articles summary: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


# Main execution
if __name__ == "__main__":
    print("🗃️  ARTICLES DATABASE SETUP")
    print("=" * 60)

    # Step 1: Create the table
    table_created = create_articles_table()

    if table_created or table_created is None:  # None means table already existed
        # Step 2: Add sample data
        add_sample_articles()

        # Step 3: Show summary
        show_articles_summary()

        print("\n🏁 Articles database setup completed!")
        print("Ready for step 2! 🚀")
    else:
        print(
            "\n❌ Could not create articles table. Please check your database permissions."
        )
        print(
            "You may need to create the table manually or contact your database administrator."
        )
