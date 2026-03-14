"""
Spire AI Collaboration - Database Repository
Handles all community theme, question, and CSV upload operations.
"""

from .database import Database


class CommunityThemeRepository:
    """Repository for user-created community quiz themes."""

    @staticmethod
    def create_theme(name, description, created_by, logo_url=None, csv_source=False):
        sql = """INSERT INTO community_themes 
                 (name, description, logo_url, created_by, csv_source, status) 
                 VALUES (%s, %s, %s, %s, %s, 'draft')"""
        return Database.execute_sql(
            sql, [name, description, logo_url, created_by, csv_source]
        )

    @staticmethod
    def get_all_public_themes():
        sql = """SELECT ct.*, u.first_name as creator_name,
                 (SELECT COUNT(*) FROM community_questions cq WHERE cq.community_theme_id = ct.id) as question_count,
                 ROUND(CASE WHEN ct.rating_count > 0 THEN ct.rating_sum / ct.rating_count ELSE 0 END, 1) as avg_rating
                 FROM community_themes ct
                 JOIN users u ON ct.created_by = u.id
                 WHERE ct.status = 'approved' AND ct.is_public = TRUE
                 ORDER BY ct.play_count DESC, ct.created_at DESC"""
        return Database.get_rows(sql)

    @staticmethod
    def get_themes_by_user(user_id):
        sql = """SELECT ct.*, u.first_name as creator_name,
                 (SELECT COUNT(*) FROM community_questions cq WHERE cq.community_theme_id = ct.id) as question_count,
                 ROUND(CASE WHEN ct.rating_count > 0 THEN ct.rating_sum / ct.rating_count ELSE 0 END, 1) as avg_rating
                 FROM community_themes ct
                 JOIN users u ON ct.created_by = u.id
                 WHERE ct.created_by = %s
                 ORDER BY ct.created_at DESC"""
        return Database.get_rows(sql, [user_id])

    @staticmethod
    def get_theme_by_id(theme_id):
        sql = """SELECT ct.*, u.first_name as creator_name,
                 (SELECT COUNT(*) FROM community_questions cq WHERE cq.community_theme_id = ct.id) as question_count
                 FROM community_themes ct
                 JOIN users u ON ct.created_by = u.id
                 WHERE ct.id = %s"""
        return Database.get_one_row(sql, [theme_id])

    @staticmethod
    def get_pending_themes():
        sql = """SELECT ct.*, u.first_name as creator_name,
                 (SELECT COUNT(*) FROM community_questions cq WHERE cq.community_theme_id = ct.id) as question_count
                 FROM community_themes ct
                 JOIN users u ON ct.created_by = u.id
                 WHERE ct.status = 'pending_review'
                 ORDER BY ct.created_at ASC"""
        return Database.get_rows(sql)

    @staticmethod
    def submit_for_review(theme_id, user_id):
        sql = """UPDATE community_themes 
                 SET status = 'pending_review' 
                 WHERE id = %s AND created_by = %s AND status = 'draft'"""
        return Database.execute_sql(sql, [theme_id, user_id])

    @staticmethod
    def approve_theme(theme_id, reviewer_id, notes=None):
        sql = """UPDATE community_themes 
                 SET status = 'approved', is_public = TRUE, reviewer_id = %s, 
                     review_notes = %s, reviewed_at = NOW()
                 WHERE id = %s"""
        return Database.execute_sql(sql, [reviewer_id, notes, theme_id])

    @staticmethod
    def reject_theme(theme_id, reviewer_id, notes=None):
        sql = """UPDATE community_themes 
                 SET status = 'rejected', reviewer_id = %s, 
                     review_notes = %s, reviewed_at = NOW()
                 WHERE id = %s"""
        return Database.execute_sql(sql, [reviewer_id, notes, theme_id])

    @staticmethod
    def promote_to_official(theme_id):
        """Promote an approved community theme to an official theme in the main themes table."""
        theme = CommunityThemeRepository.get_theme_by_id(theme_id)
        if not theme:
            return None
        # Create official theme
        from .datarepository import ThemeRepository

        official_id = ThemeRepository.create_theme(
            name=theme["name"],
            description=theme["description"],
            logo_url=theme.get("logo_url"),
            is_active=True,
        )
        if not official_id:
            return None
        # Migrate questions to official system
        questions = CommunityQuestionRepository.get_questions_by_theme(theme_id)
        from .datarepository import AnswerRepository, QuestionRepository

        difficulty_map = {"easy": 1, "medium": 2, "hard": 3, "expert": 4}
        for q in questions:
            q_id = QuestionRepository.create_question(
                question_text=q["question_text"],
                theme_id=official_id,
                difficulty_level_id=difficulty_map.get(q["difficulty"], 2),
                explanation=q.get("explanation"),
                time_limit=q.get("time_limit", 30),
                points=q.get("points", 10),
                is_active=True,
            )
            if q_id:
                answers = CommunityAnswerRepository.get_answers_for_question(q["id"])
                for a in answers:
                    AnswerRepository.create_answer(
                        question_id=q_id,
                        answer_text=a["answer_text"],
                        is_correct=bool(a["is_correct"]),
                    )
        return official_id

    @staticmethod
    def update_theme(theme_id, user_id, name=None, description=None, logo_url=None):
        updates = []
        params = []
        if name is not None:
            updates.append("name = %s")
            params.append(name)
        if description is not None:
            updates.append("description = %s")
            params.append(description)
        if logo_url is not None:
            updates.append("logo_url = %s")
            params.append(logo_url)
        if not updates:
            return False
        sql = f"UPDATE community_themes SET {', '.join(updates)} WHERE id = %s AND created_by = %s"
        params.extend([theme_id, user_id])
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_theme(theme_id, user_id):
        sql = "DELETE FROM community_themes WHERE id = %s AND created_by = %s"
        return Database.execute_sql(sql, [theme_id, user_id])

    @staticmethod
    def increment_play_count(theme_id):
        sql = "UPDATE community_themes SET play_count = play_count + 1 WHERE id = %s"
        return Database.execute_sql(sql, [theme_id])

    @staticmethod
    def search_themes(query):
        sql = """SELECT ct.*, u.first_name as creator_name,
                 (SELECT COUNT(*) FROM community_questions cq WHERE cq.community_theme_id = ct.id) as question_count,
                 ROUND(CASE WHEN ct.rating_count > 0 THEN ct.rating_sum / ct.rating_count ELSE 0 END, 1) as avg_rating
                 FROM community_themes ct
                 JOIN users u ON ct.created_by = u.id
                 WHERE ct.status = 'approved' AND ct.is_public = TRUE
                 AND (ct.name LIKE %s OR ct.description LIKE %s)
                 ORDER BY ct.play_count DESC"""
        like = f"%{query}%"
        return Database.get_rows(sql, [like, like])

    @staticmethod
    def get_stats():
        sql = """SELECT 
                 COUNT(*) as total_themes,
                 SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                 SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending,
                 SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                 SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
                 SUM(play_count) as total_plays
                 FROM community_themes"""
        return Database.get_one_row(sql)


class CommunityQuestionRepository:
    """Repository for questions within community themes."""

    @staticmethod
    def create_question(
        community_theme_id,
        question_text,
        explanation=None,
        difficulty="medium",
        time_limit=30,
        points=10,
        image_url=None,
        is_ai_generated=False,
    ):
        sql = """INSERT INTO community_questions 
                 (community_theme_id, question_text, explanation, difficulty, 
                  time_limit, points, image_url, is_ai_generated)
                 VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
        return Database.execute_sql(
            sql,
            [
                community_theme_id,
                question_text,
                explanation,
                difficulty,
                time_limit,
                points,
                image_url,
                is_ai_generated,
            ],
        )

    @staticmethod
    def get_questions_by_theme(community_theme_id):
        sql = """SELECT cq.*, 
                 (SELECT COUNT(*) FROM community_answers ca WHERE ca.community_question_id = cq.id) as answer_count,
                 (SELECT COUNT(*) FROM community_answers ca WHERE ca.community_question_id = cq.id AND ca.is_correct = TRUE) as correct_count
                 FROM community_questions cq
                 WHERE cq.community_theme_id = %s
                 ORDER BY cq.id ASC"""
        return Database.get_rows(sql, [community_theme_id])

    @staticmethod
    def get_question_by_id(question_id):
        sql = "SELECT * FROM community_questions WHERE id = %s"
        return Database.get_one_row(sql, [question_id])

    @staticmethod
    def get_questions_with_answers(community_theme_id):
        questions = CommunityQuestionRepository.get_questions_by_theme(
            community_theme_id
        )
        for q in questions:
            q["answers"] = CommunityAnswerRepository.get_answers_for_question(q["id"])
        return questions

    @staticmethod
    def update_question(question_id, **kwargs):
        allowed = [
            "question_text",
            "explanation",
            "difficulty",
            "time_limit",
            "points",
            "image_url",
        ]
        updates = []
        params = []
        for key in allowed:
            if key in kwargs and kwargs[key] is not None:
                updates.append(f"{key} = %s")
                params.append(kwargs[key])
        if not updates:
            return False
        sql = f"UPDATE community_questions SET {', '.join(updates)} WHERE id = %s"
        params.append(question_id)
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_question(question_id):
        sql = "DELETE FROM community_questions WHERE id = %s"
        return Database.execute_sql(sql, [question_id])

    @staticmethod
    def get_random_questions(community_theme_id, limit=10):
        sql = """SELECT cq.* FROM community_questions cq
                 WHERE cq.community_theme_id = %s
                 ORDER BY RAND()
                 LIMIT %s"""
        return Database.get_rows(sql, [community_theme_id, limit])

    @staticmethod
    def bulk_create_from_csv(community_theme_id, questions_data):
        """Import multiple questions from parsed CSV data.

        questions_data: list of dicts with keys:
            question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3,
            explanation (optional), difficulty (optional)

        Returns (imported_count, failed_count, errors)
        """
        imported = 0
        failed = 0
        errors = []

        for i, row in enumerate(questions_data):
            try:
                q_text = row.get("question", row.get("question_text", "")).strip()
                if not q_text:
                    errors.append(f"Row {i+1}: Missing question text")
                    failed += 1
                    continue

                correct = row.get("correct_answer", row.get("answer", "")).strip()
                if not correct:
                    errors.append(f"Row {i+1}: Missing correct answer")
                    failed += 1
                    continue

                wrong1 = row.get("wrong_answer_1", row.get("wrong1", "")).strip()
                wrong2 = row.get("wrong_answer_2", row.get("wrong2", "")).strip()
                wrong3 = row.get("wrong_answer_3", row.get("wrong3", "")).strip()

                wrong_answers = [w for w in [wrong1, wrong2, wrong3] if w]
                if len(wrong_answers) < 1:
                    errors.append(f"Row {i+1}: Need at least 1 wrong answer")
                    failed += 1
                    continue

                difficulty = row.get("difficulty", "medium").strip().lower()
                if difficulty not in ("easy", "medium", "hard", "expert"):
                    difficulty = "medium"

                explanation = row.get("explanation", "").strip() or None
                is_ai = row.get(
                    "ai_generated", row.get("is_ai_generated", "")
                ).strip().lower() in ("true", "1", "yes")

                q_id = CommunityQuestionRepository.create_question(
                    community_theme_id=community_theme_id,
                    question_text=q_text,
                    explanation=explanation,
                    difficulty=difficulty,
                    is_ai_generated=is_ai,
                )

                if not q_id:
                    errors.append(f"Row {i+1}: Database insert failed")
                    failed += 1
                    continue

                # Add correct answer
                CommunityAnswerRepository.create_answer(q_id, correct, True)
                # Add wrong answers
                for wrong in wrong_answers:
                    CommunityAnswerRepository.create_answer(q_id, wrong, False)

                imported += 1

            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
                failed += 1

        return imported, failed, errors


class CommunityAnswerRepository:
    """Repository for answers to community questions."""

    @staticmethod
    def create_answer(community_question_id, answer_text, is_correct=False):
        sql = """INSERT INTO community_answers 
                 (community_question_id, answer_text, is_correct) 
                 VALUES (%s, %s, %s)"""
        return Database.execute_sql(
            sql, [community_question_id, answer_text, is_correct]
        )

    @staticmethod
    def get_answers_for_question(community_question_id):
        sql = "SELECT * FROM community_answers WHERE community_question_id = %s ORDER BY id"
        return Database.get_rows(sql, [community_question_id])

    @staticmethod
    def update_answer(answer_id, answer_text=None, is_correct=None):
        updates = []
        params = []
        if answer_text is not None:
            updates.append("answer_text = %s")
            params.append(answer_text)
        if is_correct is not None:
            updates.append("is_correct = %s")
            params.append(is_correct)
        if not updates:
            return False
        sql = f"UPDATE community_answers SET {', '.join(updates)} WHERE id = %s"
        params.append(answer_id)
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_answer(answer_id):
        sql = "DELETE FROM community_answers WHERE id = %s"
        return Database.execute_sql(sql, [answer_id])

    @staticmethod
    def delete_answers_for_question(community_question_id):
        sql = "DELETE FROM community_answers WHERE community_question_id = %s"
        return Database.execute_sql(sql, [community_question_id])


class CommunityRatingRepository:
    """Repository for community theme ratings."""

    @staticmethod
    def rate_theme(community_theme_id, user_id, rating):
        # Check if user already rated
        existing = Database.get_one_row(
            "SELECT id, rating FROM community_theme_ratings WHERE community_theme_id = %s AND user_id = %s",
            [community_theme_id, user_id],
        )
        if existing:
            old_rating = existing["rating"]
            Database.execute_sql(
                "UPDATE community_theme_ratings SET rating = %s WHERE id = %s",
                [rating, existing["id"]],
            )
            Database.execute_sql(
                "UPDATE community_themes SET rating_sum = rating_sum - %s + %s WHERE id = %s",
                [old_rating, rating, community_theme_id],
            )
        else:
            Database.execute_sql(
                "INSERT INTO community_theme_ratings (community_theme_id, user_id, rating) VALUES (%s, %s, %s)",
                [community_theme_id, user_id, rating],
            )
            Database.execute_sql(
                "UPDATE community_themes SET rating_sum = rating_sum + %s, rating_count = rating_count + 1 WHERE id = %s",
                [rating, community_theme_id],
            )
        return True

    @staticmethod
    def get_user_rating(community_theme_id, user_id):
        sql = "SELECT rating FROM community_theme_ratings WHERE community_theme_id = %s AND user_id = %s"
        result = Database.get_one_row(sql, [community_theme_id, user_id])
        return result["rating"] if result else None


class CsvUploadRepository:
    """Repository for CSV upload tracking."""

    @staticmethod
    def create_upload(
        user_id, community_theme_id, filename, imported, failed, error_log=None
    ):
        sql = """INSERT INTO csv_uploads 
                 (user_id, community_theme_id, original_filename, questions_imported, questions_failed, error_log)
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        return Database.execute_sql(
            sql, [user_id, community_theme_id, filename, imported, failed, error_log]
        )

    @staticmethod
    def get_uploads_by_user(user_id):
        sql = """SELECT cu.*, ct.name as theme_name 
                 FROM csv_uploads cu
                 JOIN community_themes ct ON cu.community_theme_id = ct.id
                 WHERE cu.user_id = %s
                 ORDER BY cu.uploaded_at DESC"""
        return Database.get_rows(sql, [user_id])
