import config
import mysql.connector


def list_world_cuisine_questions():
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        # Get the stories theme ID
        cursor.execute("SELECT id, name FROM themes WHERE name = 'stories'")
        theme = cursor.fetchone()
        if not theme:
            print("stories theme not found!")
            return

        theme_id, theme_name = theme
        print(f"=== {theme_name} Questions ===\n")

        # Get all questions for this theme
        cursor.execute(
            """
            SELECT id, question_text, difficultyLevelId, points, time_limit, explanation, Url 
            FROM questions 
            WHERE themeId = %s 
            ORDER BY id
        """,
            (theme_id,),
        )

        questions = cursor.fetchall()

        if not questions:
            print("No questions found for this theme!")
            return

        print(f"Total questions: {len(questions)}\n")

        # Display each question with details
        for i, question in enumerate(questions, 1):
            q_id, question_text, difficulty, points, time_limit, explanation, url = (
                question
            )

            print(f"{i}. ID: {q_id}")
            print(f"   Question: {question_text}")
            print(
                f"   Difficulty: {difficulty} | Points: {points} | Time: {time_limit}s"
            )
            if url:
                print(f"   URL: {url}")
            print(f"   Explanation: {explanation if explanation else 'N/A'}")

            # Get answers for this question
            cursor.execute(
                """
                SELECT answer_text, is_correct 
                FROM answers 
                WHERE questionId = %s 
                ORDER BY id
            """,
                (q_id,),
            )

            answers = cursor.fetchall()
            print("   Answers:")
            for answer_text, is_correct in answers:
                correct_status = "✓" if is_correct else "✗"
                print(f"     {correct_status} {answer_text}")

            print("-" * 80)
            print()  # Add spacing between questions

    except mysql.connector.Error as e:
        print(f"Error retrieving questions: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


# Run the function to list all questions
list_world_cuisine_questions()
