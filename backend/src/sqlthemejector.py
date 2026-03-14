import config
import mysql.connector


def replace_jack_with_kael():
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print("Starting replacement of 'Jack' with 'Kael'...")

        # Count occurrences before replacement
        cursor.execute(
            "SELECT COUNT(*) FROM questions WHERE question_text LIKE '%Jack%' OR explanation LIKE '%Jack%'"
        )
        questions_before = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM answers WHERE answer_text LIKE '%Jack%'")
        answers_before = cursor.fetchone()[0]

        print(
            f"Found {questions_before} questions and {answers_before} answers with 'Jack'"
        )

        # Update questions table
        cursor.execute("""
            UPDATE questions 
            SET question_text = REPLACE(question_text, 'Jack', 'Kael'),
                explanation = REPLACE(explanation, 'Jack', 'Kael')
            WHERE question_text LIKE '%Jack%' OR explanation LIKE '%Jack%'
        """)
        questions_updated = cursor.rowcount
        print(f"Updated {questions_updated} questions")

        # Update answers table
        cursor.execute("""
            UPDATE answers 
            SET answer_text = REPLACE(answer_text, 'Jack', 'Kael')
            WHERE answer_text LIKE '%Jack%'
        """)
        answers_updated = cursor.rowcount
        print(f"Updated {answers_updated} answers")

        # Commit the changes
        connection.commit()

        # Verify the changes
        cursor.execute(
            "SELECT COUNT(*) FROM questions WHERE question_text LIKE '%Jack%' OR explanation LIKE '%Jack%'"
        )
        questions_after = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM answers WHERE answer_text LIKE '%Jack%'")
        answers_after = cursor.fetchone()[0]

        print(f"\nVerification:")
        print(f"Questions with 'Jack' after update: {questions_after}")
        print(f"Answers with 'Jack' after update: {answers_after}")

        if questions_after == 0 and answers_after == 0:
            print("✅ Successfully replaced all instances of 'Jack' with 'Kael'")
        else:
            print("⚠️ Some instances may still remain")

        # Show some examples of the changes
        print(f"\nSample of updated questions:")
        cursor.execute("""
            SELECT id, SUBSTRING(question_text, 1, 80) as preview 
            FROM questions 
            WHERE question_text LIKE '%Kael%' 
            LIMIT 5
        """)
        updated_questions = cursor.fetchall()

        for q_id, preview in updated_questions:
            print(f"ID {q_id}: {preview}...")

    except mysql.connector.Error as e:
        print(f"Error replacing names: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


def check_kael_mentions():
    """Check how many times Kael now appears in the database"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        cursor.execute(
            "SELECT COUNT(*) FROM questions WHERE question_text LIKE '%Kael%' OR explanation LIKE '%Kael%'"
        )
        questions_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM answers WHERE answer_text LIKE '%Kael%'")
        answers_count = cursor.fetchone()[0]

        print(f"\nCurrent database state:")
        print(f"Questions mentioning 'Kael': {questions_count}")
        print(f"Answers mentioning 'Kael': {answers_count}")

        # Show distribution across themes
        cursor.execute("""
            SELECT t.name, COUNT(*) 
            FROM questions q 
            JOIN themes t ON q.themeId = t.id 
            WHERE q.question_text LIKE '%Kael%' OR q.explanation LIKE '%Kael%'
            GROUP BY t.name
        """)
        theme_distribution = cursor.fetchall()

        print(f"\nDistribution across themes:")
        for theme_name, count in theme_distribution:
            print(f"  {theme_name}: {count} questions")

    except mysql.connector.Error as e:
        print(f"Error checking database: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


# Run the replacement
print("=" * 60)
replace_jack_with_kael()

print("\n" + "=" * 60)
check_kael_mentions()

print("\n" + "=" * 60)
print("Name replacement completed successfully!")
