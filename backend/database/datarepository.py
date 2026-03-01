from .database import Database
from datetime import datetime,  timedelta
from typing import List, Optional, Dict, Any
import bcrypt
import json

class QuestionRepository:
    
    # CREATE operations
    @staticmethod
    def create_question(question_text, themeId, difficultyLevelId, explanation=None, Url=None, 
                       time_limit=30, think_time=0, points=10, is_active=False, 
                       no_answer_correct=False, createdBy=None, LightMax=None, 
                       LightMin=None, TempMax=None, TempMin=None):
        sql = """
        INSERT INTO questions 
        (question_text, themeId, difficultyLevelId, explanation, Url, time_limit, 
         think_time, points, is_active, no_answer_correct, createdBy, LightMax, 
         LightMin, TempMax, TempMin) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [question_text, themeId, difficultyLevelId, explanation, Url, 
                 time_limit, think_time, points, is_active, no_answer_correct, 
                 createdBy, LightMax, LightMin, TempMax, TempMin]
        return Database.execute_sql(sql, params)
    
    # READ operations
    @staticmethod
    def get_all_questions(active_only=False):
        sql = "SELECT * FROM questions"
        if active_only:
            sql += " WHERE is_active = TRUE"
        sql += " ORDER BY id ASC"
        return Database.get_rows(sql)
    
    @staticmethod
    def get_questions_by_session(session_id: int) -> List[Dict[str, Any]]:
        """Get all questions that were answered in a specific session."""
        sql = """
            SELECT DISTINCT q.*
            FROM questions q
            INNER JOIN playerAnswers pa ON q.id = pa.questionId
            WHERE pa.sessionId = %s
            ORDER BY q.id
        """
        params = [session_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_questions_count_by_theme(theme_id):
        sql = "SELECT COUNT(*) as count FROM questions WHERE themeId = %s"
        params = [theme_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0

    @staticmethod
    def get_question_by_id(question_id):
        sql = "SELECT * FROM questions WHERE id = %s"
        params = [question_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_questions_by_theme(themeId, active_only=False):
        sql = "SELECT * FROM questions WHERE themeId = %s"
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY id ASC"
        params = [themeId]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_questions_by_difficulty(difficultyLevelId, active_only=False):
        sql = "SELECT * FROM questions WHERE difficultyLevelId = %s"
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY id ASC"
        params = [difficultyLevelId]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_questions_by_theme_and_difficulty(themeId, difficultyLevelId, active_only=False):
        sql = "SELECT * FROM questions WHERE themeId = %s AND difficultyLevelId = %s"
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY id ASC"
        params = [themeId, difficultyLevelId]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_active_questions():
        return QuestionRepository.get_all_questions(active_only=True)
    
    # UPDATE operations
    @staticmethod
    def update_question(question_id, question_text=None, themeId=None, difficultyLevelId=None, 
                       explanation=None, Url=None, time_limit=None, think_time=None, 
                       points=None, is_active=None, no_answer_correct=None, LightMax=None, 
                       LightMin=None, TempMax=None, TempMin=None):
        # Build dynamic SQL based on provided fields
        sql = "UPDATE questions SET "
        updates = []
        params = []
        
        if question_text is not None:
            updates.append("question_text = %s")
            params.append(question_text)
        if themeId is not None:
            updates.append("themeId = %s")
            params.append(themeId)
        if difficultyLevelId is not None:
            updates.append("difficultyLevelId = %s")
            params.append(difficultyLevelId)
        if explanation is not None:
            updates.append("explanation = %s")
            params.append(explanation)
        if Url is not None:
            updates.append("Url = %s")
            params.append(Url)
        if time_limit is not None:
            updates.append("time_limit = %s")
            params.append(time_limit)
        if think_time is not None:
            updates.append("think_time = %s")
            params.append(think_time)
        if points is not None:
            updates.append("points = %s")
            params.append(points)
        if is_active is not None:
            updates.append("is_active = %s")
            params.append(is_active)
        if no_answer_correct is not None:
            updates.append("no_answer_correct = %s")
            params.append(no_answer_correct)
        if LightMax is not None:
            updates.append("LightMax = %s")
            params.append(LightMax)
        if LightMin is not None:
            updates.append("LightMin = %s")
            params.append(LightMin)
        if TempMax is not None:
            updates.append("TempMax = %s")
            params.append(TempMax)
        if TempMin is not None:
            updates.append("TempMin = %s")
            params.append(TempMin)
            
        if not updates:
            return False  # Nothing to update
            
        sql += ", ".join(updates)
        sql += " WHERE id = %s"
        params.append(question_id)
        
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def activate_question(question_id):
        sql = "UPDATE questions SET is_active = TRUE WHERE id = %s"
        params = [question_id]
        return Database.execute_sql(sql, params)
    

    @staticmethod
    def get_active_questions_count():      
        sql = "SELECT COUNT(*) FROM questions WHERE is_active = TRUE"
        print(f"Executing SQL: {sql}")
        result = Database.execute_sql(sql)
        
        # Convert the string result to an integer
        try:
            return int(result)
        except (TypeError, ValueError):
            return 0  # Fallback in case conversion fails

    @staticmethod
    def deactivate_question(question_id):
        sql = "UPDATE questions SET is_active = FALSE WHERE id = %s"
        params = [question_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_question_text(question_id, question_text):
        sql = "UPDATE questions SET question_text = %s WHERE id = %s"
        params = [question_text, question_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_question_explanation(question_id, explanation):
        sql = "UPDATE questions SET explanation = %s WHERE id = %s"
        params = [explanation, question_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_question_metadata(question_id, time_limit=None, think_time=None, points=None):
        sql = "UPDATE questions SET "
        updates = []
        params = []
        
        if time_limit is not None:
            updates.append("time_limit = %s")
            params.append(time_limit)
        if think_time is not None:
            updates.append("think_time = %s")
            params.append(think_time)
        if points is not None:
            updates.append("points = %s")
            params.append(points)
            
        if not updates:
            return False
            
        sql += ", ".join(updates)
        sql += " WHERE id = %s"
        params.append(question_id)
        
        return Database.execute_sql(sql, params)
    
    # MIGRATION operations
    @staticmethod
    def migrate_questions_to_theme(source_theme_id, target_theme_id):
        """
        Migrate all questions from source theme to target theme.
        Returns True if successful, False otherwise.
        """
        try:
            sql = "UPDATE questions SET themeId = %s WHERE themeId = %s"
            params = [target_theme_id, source_theme_id]
            result = Database.execute_sql(sql, params)
            return result is not None
        except Exception as e:
            print(f"Error migrating questions: {e}")
            return False
    
    # DELETE operations
    @staticmethod
    def delete_question(question_id):
        sql = "DELETE FROM questions WHERE id = %s"
        params = [question_id]
        return Database.execute_sql(sql, params)
    
    # SPECIAL operations
    @staticmethod
    def search_questions(search_term, active_only=False):
        sql = """
        SELECT * FROM questions 
        WHERE question_text LIKE %s OR explanation LIKE %s
        """
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY id ASC"
        params = [f"%{search_term}%", f"%{search_term}%"]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_questions_with_answers(question_id=None):
        sql = """
        SELECT q.*, a.id as answer_id, a.answer_text, a.is_correct 
        FROM questions q
        LEFT JOIN answers a ON q.id = a.questionId
        """
        if question_id:
            sql += " WHERE q.id = %s"
            params = [question_id]
            return Database.get_rows(sql, params)
        else:
            sql += " ORDER BY q.id, a.id ASC"
            return Database.get_rows(sql)
    
    @staticmethod
    def get_random_question(themeId=None, difficultyLevelId=None):
        sql = "SELECT * FROM questions WHERE is_active = TRUE"
        params = []
        
        if themeId:
            sql += " AND themeId = %s"
            params.append(themeId)
        if difficultyLevelId:
            sql += " AND difficultyLevelId = %s"
            params.append(difficultyLevelId)
            
        sql += " ORDER BY RAND() LIMIT 1"
        
        if params:
            return Database.get_one_row(sql, params)
        else:
            return Database.get_one_row(sql)
        


class AnswerRepository:
    
    # CREATE operations
    @staticmethod
    def create_answer(question_id, answer_text, is_correct=False):
        sql = "INSERT INTO answers (questionId, answer_text, is_correct) VALUES (%s, %s, %s)"
        params = [question_id, answer_text, is_correct]
        return Database.execute_sql(sql, params)
    
    # READ operations
    @staticmethod
    def get_all_answers_for_question(question_id):
        sql = "SELECT * FROM answers WHERE questionId = %s ORDER BY id ASC"
        params = [question_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_answer_by_id(answer_id):
        sql = "SELECT * FROM answers WHERE id = %s"
        params = [answer_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_correct_answers_for_question(question_id):
        sql = "SELECT * FROM answers WHERE questionId = %s AND is_correct = TRUE ORDER BY id ASC"
        params = [question_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_incorrect_answers_for_question(question_id):
        sql = "SELECT * FROM answers WHERE questionId = %s AND is_correct = FALSE ORDER BY id ASC"
        params = [question_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_answers_count_for_question(question_id):
        sql = "SELECT COUNT(*) as count FROM answers WHERE questionId = %s"
        params = [question_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0
    
    @staticmethod
    def get_correct_answers_count_for_question(question_id):
        sql = "SELECT COUNT(*) as count FROM answers WHERE questionId = %s AND is_correct = TRUE"
        params = [question_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0
    
    # UPDATE operations
    @staticmethod
    def update_answer(answer_id, answer_text=None, is_correct=None):
        sql = "UPDATE answers SET "
        updates = []
        params = []
        
        if answer_text is not None:
            updates.append("answer_text = %s")
            params.append(answer_text)
        if is_correct is not None:
            updates.append("is_correct = %s")
            params.append(is_correct)
            
        if not updates:
            return False  # Nothing to update
            
        sql += ", ".join(updates)
        sql += " WHERE id = %s"
        params.append(answer_id)
        
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_answer_text(answer_id, answer_text):
        sql = "UPDATE answers SET answer_text = %s WHERE id = %s"
        params = [answer_text, answer_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def mark_answer_as_correct(answer_id):
        sql = "UPDATE answers SET is_correct = TRUE WHERE id = %s"
        params = [answer_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def mark_answer_as_incorrect(answer_id):
        sql = "UPDATE answers SET is_correct = FALSE WHERE id = %s"
        params = [answer_id]
        return Database.execute_sql(sql, params)
    
    # DELETE operations
    @staticmethod
    def delete_answer(answer_id):
        sql = "DELETE FROM answers WHERE id = %s"
        params = [answer_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def delete_all_answers_for_question(question_id):
        sql = "DELETE FROM answers WHERE questionId = %s"
        params = [question_id]
        return Database.execute_sql(sql, params)
    
    # SPECIAL operations
    @staticmethod
    def set_all_answers_incorrect_for_question(question_id):
        sql = "UPDATE answers SET is_correct = FALSE WHERE questionId = %s"
        params = [question_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def set_single_correct_answer_for_question(question_id, correct_answer_id):
        # First set all answers as incorrect
        AnswerRepository.set_all_answers_incorrect_for_question(question_id)
        # Then set the specified answer as correct
        sql = "UPDATE answers SET is_correct = TRUE WHERE id = %s AND questionId = %s"
        params = [correct_answer_id, question_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def has_correct_answer(question_id):
        sql = "SELECT COUNT(*) as count FROM answers WHERE questionId = %s AND is_correct = TRUE"
        params = [question_id]
        result = Database.get_one_row(sql, params)
        return result['count'] > 0 if result else False
    

class ThemeRepository:

    # CREATE operations
    @staticmethod
    def create_theme(name: str, description: str = None, logo_url: str = None, is_active: bool = True):
        sql = "INSERT INTO themes (name, description, logoUrl, is_active) VALUES (%s, %s, %s, %s)"
        params = [name, description, logo_url, is_active]
        return Database.execute_sql(sql, params)

    # READ operations
    @staticmethod
    def get_all_themes():
        sql = """SELECT t.*, COUNT(q.id) as question_count
                 FROM themes t
                 LEFT JOIN questions q ON q.themeId = t.id
                 GROUP BY t.id
                 ORDER BY t.name ASC"""
        return Database.get_rows(sql)

    @staticmethod
    def get_active_themes():
        sql = """SELECT t.*, COUNT(q.id) as question_count
                 FROM themes t
                 LEFT JOIN questions q ON q.themeId = t.id
                 WHERE t.is_active = TRUE
                 GROUP BY t.id
                 ORDER BY t.name ASC"""
        return Database.get_rows(sql)

    @staticmethod
    def get_theme_by_id(theme_id: int):
        sql = "SELECT * FROM themes WHERE id = %s"
        params = [theme_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_theme_by_name(name: str):
        sql = "SELECT * FROM themes WHERE name = %s"
        params = [name]
        return Database.get_one_row(sql, params)

    # UPDATE operations
    @staticmethod
    def update_theme(theme_id: int, name: str = None, description: str = None, logo_url: str = None, is_active: bool = None):
        sql = "UPDATE themes SET "
        updates = []
        params = []

        if name is not None:
            updates.append("name = %s")
            params.append(name)
        if description is not None:
            updates.append("description = %s")
            params.append(description)
        if logo_url is not None:
            updates.append("logoUrl = %s")
            params.append(logo_url)
        if is_active is not None:
            updates.append("is_active = %s")
            params.append(is_active)

        if not updates:
            return False  # Nothing to update

        sql += ", ".join(updates)
        sql += " WHERE id = %s"
        params.append(theme_id)

        return Database.execute_sql(sql, params)

    @staticmethod
    def set_theme_active_status(theme_id: int, status: bool):
        sql = "UPDATE themes SET is_active = %s WHERE id = %s"
        params = [status, theme_id]
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_theme(theme_id: int):
        # First set all references to NULL
        update_sql = "UPDATE quizSessions SET themeId = NULL WHERE themeId = %s"
        
        # Then delete the theme
        delete_sql = "DELETE FROM themes WHERE id = %s"
        
        # Execute both in a transaction
        try:
            Database.execute_sql("START TRANSACTION", [])
            Database.execute_sql(update_sql, [theme_id])
            result = Database.execute_sql(delete_sql, [theme_id])
            Database.execute_sql("COMMIT", [])
            return result
        except Exception as e:
            Database.execute_sql("ROLLBACK", [])
            raise e
    

class UserRepository:

    # --- Password Hashing Utilities ---
    @staticmethod
    def hash_password(password: str) -> Dict[str, str]:
        """Hashes a password and returns the hash and salt."""
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        return {"password_hash": hashed_password, "salt": salt.decode('utf-8')}

    @staticmethod
    def verify_password(password: str, hashed_password: str, salt: str) -> bool:
        """Verifies a plaintext password against a hashed password and salt."""
        # Ensure that the salt is combined correctly if it was stored separately
        # If the original hash_password combines them like (hashed_password + salt)
        # then this check should reflect that. Otherwise, it's just bcrypt.checkpw(password.encode(), hashed_password.encode())
        return bcrypt.checkpw(password.encode('utf-8'), (hashed_password + salt).encode('utf-8'))

    # --- CRUD Operations ---

    @staticmethod
    def create_user(user_data: Dict[str, Any]) -> Optional[int]:
        """Inserts a new user into the database."""
        sql = """
            INSERT INTO users (last_name, first_name, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        # Hash the password before inserting
        hashed_info = UserRepository.hash_password(user_data['password'])
        params = [
            user_data['last_name'],
            user_data['first_name'],
            hashed_info['password_hash'],
            hashed_info['salt'],
            user_data.get('rfid_code'),
            user_data['userRoleId'],
            user_data.get('soul_points', 4), # Default to 4 if not provided
            user_data.get('limb_points', 4), # Default to 4 if not provided
            user_data.get('updated_by')
        ]
        # Use execute_sql for inserts
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_all_users() -> List[Dict[str, Any]]:
        """Fetches all users from the database."""
        sql = "SELECT id, last_name, first_name, email, rfid_code, userRoleId, soul_points, limb_points, last_active, session_expires_at, updated_by FROM users"
        # Use get_rows which correctly handles fetching multiple dictionary rows
        return Database.get_rows(sql)

    @staticmethod
    def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
        """Fetches a single user by ID."""
        sql = "SELECT id, last_name, first_name, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, last_active, session_expires_at, updated_by FROM users WHERE id = %s"
        params = [user_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def update_user(user_id: int, update_data: Dict[str, Any]) -> bool:
        """Updates an existing user's information."""
        set_clauses = []
        params = []

        if 'last_name' in update_data:
            set_clauses.append("last_name = %s")
            params.append(update_data['last_name'])
        if 'first_name' in update_data:
            set_clauses.append("first_name = %s")
            params.append(update_data['first_name'])
        if 'password' in update_data and update_data['password'] is not None:
            # Hash new password if provided
            hashed_info = UserRepository.hash_password(update_data['password'])
            set_clauses.append("password_hash = %s")
            set_clauses.append("salt = %s")
            params.append(hashed_info['password_hash'])
            params.append(hashed_info['salt'])
        if 'rfid_code' in update_data:
            set_clauses.append("rfid_code = %s")
            params.append(update_data['rfid_code'])
        if 'userRoleId' in update_data:
            set_clauses.append("userRoleId = %s")
            params.append(update_data['userRoleId'])
        if 'soul_points' in update_data:
            set_clauses.append("soul_points = %s")
            params.append(update_data['soul_points'])
        if 'limb_points' in update_data:
            set_clauses.append("limb_points = %s")
            params.append(update_data['limb_points'])
        if 'updated_by' in update_data:
            set_clauses.append("updated_by = %s")
            params.append(update_data['updated_by'])

        if not set_clauses:
            return False # Nothing to update

        sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s"
        params.append(user_id)
        # Use execute_sql for updates
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_user(user_id: int) -> bool:
        """Deletes a user by ID."""
        sql = "DELETE FROM users WHERE id = %s"
        params = [user_id]
        # Use execute_sql for deletes
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_user_by_rfid(rfid_code: str) -> Optional[Dict[str, Any]]:
        """Fetches a user by RFID code."""
        sql = "SELECT id, last_name, first_name, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, last_active, session_expires_at, updated_by FROM users WHERE rfid_code = %s"
        params = [rfid_code]
        return Database.get_one_row(sql, params)

    @staticmethod
    def set_user_active_status(user_id: int, is_active: bool) -> bool:
        """Sets the last_active and session_expires_at for a user."""
        current_time = datetime.now()
        if is_active:
            # Session expires in, say, 1 hour
            session_expiry = current_time + timedelta(hours=1)
            sql = "UPDATE users SET last_active = %s, session_expires_at = %s WHERE id = %s"
            params = [current_time, session_expiry, user_id]
        else:
            # Clear session on logout
            sql = "UPDATE users SET last_active = NULL, session_expires_at = NULL WHERE id = %s"
            params = [user_id]
        return Database.execute_sql(sql, params)

    @staticmethod
    def update_user_names_by_rfid(rfid_code: str, first_name: str, last_name: str) -> bool:
        """Updates the first_name and last_name of a user based on their RFID code."""
        sql = """
            UPDATE users
            SET first_name = %s, last_name = %s
            WHERE rfid_code = %s
        """
        params = [first_name, last_name, rfid_code]
        affected_rows = Database.execute_sql(sql, params)
        return affected_rows is not None and affected_rows > 0
    


    @staticmethod
    def hash_password(password: str) -> Dict[str, str]:
        """Hashes a password using bcrypt and generates a salt."""
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        return {"password_hash": hashed_password, "salt": salt.decode('utf-8')}

    @staticmethod
    def verify_password(password_hash: str, salt: str, provided_password: str) -> bool:
        """Verifies a provided password against a stored hash and salt."""
        try:
            return bcrypt.checkpw(provided_password.encode('utf-8'), password_hash.encode('utf-8'))
        except ValueError:
            # Hash or salt might be malformed
            return False

    @staticmethod
    def get_user_by_name(first_name: str, last_name: str) -> Optional[Dict[str, Any]]:
        """Fetches a user by first and last name."""
        sql = "SELECT id, last_name, first_name, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, last_active, session_expires_at, updated_by FROM users WHERE first_name = %s AND last_name = %s"
        params = [first_name, last_name]
        return Database.get_one_row(sql, params)

    @staticmethod
    def create_user_with_password(user_data: Dict[str, Any]) -> Optional[int]:
        """Inserts a new user with a password into the database."""
        sql = """
            INSERT INTO users (last_name, first_name, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        # hash_password is called by the endpoint for password
        params = [
            user_data['last_name'],
            user_data['first_name'],
            user_data['password_hash'], # This will now come from the endpoint
            user_data['salt'],         # This will now come from the endpoint
            user_data.get('rfid_code'),
            user_data.get('userRoleId', 1), # Default to player role if not provided
            user_data.get('soul_points', 4),
            user_data.get('limb_points', 4),
            user_data.get('updated_by', 1) # Default to a system user or 1 if not provided
        ]
        return Database.execute_sql(sql, params)

    @staticmethod
    def authenticate_user(first_name: str, last_name: str, password: str) -> Optional[int]:
        """Authenticates a user by first name, last name, and password, returning user ID on success.
        Updates last_active timestamp if authentication succeeds."""
        user = UserRepository.get_user_by_name(first_name, last_name)
        if user:
            if UserRepository.verify_password(user['password_hash'], user['salt'], password):
                # Update last_active to current datetime
                UserRepository.update_user_last_active(user['id'], datetime.now())
                return user['id']
        return None

    @staticmethod
    def update_user_last_active(user_id: int, timestamp: datetime) -> None:
        """Updates the last_active timestamp for a user."""
        # Assuming you have some database connection and execution method
        query = "UPDATE users SET last_active = %s WHERE id = %s"
        params = (timestamp, user_id)
        # Execute the query using your database connection
        Database.execute_sql(query, params)

class IpAddressRepository:

    @staticmethod
    def create_ip_address(ip_address: str) -> Optional[int]:
        """
        Inserts a new IP address into the ipAddresses table.
        Returns the ID of the new IP address or None if creation fails.
        """
        sql = """
            INSERT INTO ipAddresses (ip_address)
            VALUES (%s)
        """
        params = [ip_address]
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_ip_address_by_id(ip_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetches a single IP address by its ID.
        """
        sql = "SELECT * FROM ipAddresses WHERE id = %s"
        params = [ip_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_ip_address_by_string(ip_address: str) -> Optional[Dict[str, Any]]:
        """
        Fetches a single IP address by its string value.
        """
        sql = "SELECT * FROM ipAddresses WHERE ip_address = %s"
        params = [ip_address]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_all_ip_addresses() -> List[Dict[str, Any]]:
        """
        Fetches all IP addresses from the database.
        """
        sql = "SELECT * FROM ipAddresses ORDER BY ip_address ASC"
        return Database.get_rows(sql)

    @staticmethod
    def update_ip_address(
        ip_id: int,
        is_banned: Optional[bool] = None,
        ban_reason: Optional[str] = None,
        ban_date: Optional[datetime] = None,
        banned_by: Optional[int] = None,
        ban_expires_at: Optional[datetime] = None
    ) -> bool:
        """
        Updates an existing IP address's information.
        Returns True if the update was successful, False otherwise.
        """
        set_clauses = []
        params = []

        if is_banned is not None:
            set_clauses.append("is_banned = %s")
            params.append(is_banned)
        if ban_reason is not None:
            set_clauses.append("ban_reason = %s")
            params.append(ban_reason)
        if ban_date is not None:
            set_clauses.append("ban_date = %s")
            params.append(ban_date)
        if banned_by is not None:
            set_clauses.append("banned_by = %s")
            params.append(banned_by)
        if ban_expires_at is not None:
            set_clauses.append("ban_expires_at = %s")
            params.append(ban_expires_at)

        if not set_clauses:
            return False # Nothing to update

        sql = f"UPDATE ipAddresses SET {', '.join(set_clauses)} WHERE id = %s"
        params.append(ip_id)
        # execute_sql returns rowcount for updates, which is 0 for no change, 1 for success.
        # We can convert that to a boolean.
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def delete_ip_address(ip_id: int) -> bool:
        """
        Deletes an IP address by its ID.
        Returns True if deletion was successful, False otherwise.
        """
        sql = "DELETE FROM ipAddresses WHERE id = %s"
        params = [ip_id]
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def get_banned_ip_addresses() -> List[Dict[str, Any]]:
        """
        Fetches all currently banned IP addresses.
        Considers `is_banned` and `ban_expires_at`.
        """
        sql = """
            SELECT * FROM ipAddresses
            WHERE is_banned = TRUE AND (ban_expires_at IS NULL OR ban_expires_at > NOW())
            ORDER BY ban_date DESC
        """
        return Database.get_rows(sql)

    @staticmethod
    def is_ip_banned(ip_address: str) -> bool:
        """
        Checks if a specific IP address is currently banned.
        """
        sql = """
            SELECT COUNT(*) FROM ipAddresses
            WHERE ip_address = %s AND is_banned = TRUE AND (ban_expires_at IS NULL OR ban_expires_at > NOW())
        """
        params = [ip_address]
        # execute_sql returns rowcount for selects, or 0 if nothing found.
        # get_one_row would be better for COUNT(*). Let's use get_one_row and then check its value.
        result = Database.get_one_row(sql, params)
        return result and result.get('COUNT(*)', 0) > 0 # Access by column name 'COUNT(*)'
    @staticmethod
    def get_ip_address_by_string(ip_address: str) -> Optional[Dict[str, Any]]:
        """
        Fetches a single IP address by its string value, including ban details.
        """
        sql = """
            SELECT id, ip_address, is_banned, ban_reason, ban_date, banned_by, ban_expires_at, created_at
            FROM ipAddresses
            WHERE ip_address = %s
        """
        params = [ip_address]
        return Database.get_one_row(sql, params)

    @staticmethod
    def is_ip_banned(ip_address: str) -> bool:
        """
        Checks if a specific IP address is currently banned.
        """
        sql = """
            SELECT COUNT(*) FROM ipAddresses
            WHERE ip_address = %s AND is_banned = TRUE AND (ban_expires_at IS NULL OR ban_expires_at > NOW())
        """
        params = [ip_address]
        result = Database.get_one_row(sql, params)
        return result and result.get('COUNT(*)', 0) > 0 # Access by column name 'COUNT(*)'

    # --- New method for ban appeal (to clear a ban) ---
    @staticmethod
    def appeal_ban(ip_address: str) -> bool:
        """
        Clears the ban status for a specific IP address.
        """
        sql = """
            UPDATE ipAddresses
            SET is_banned = FALSE, ban_reason = NULL, ban_date = NULL, banned_by = NULL, ban_expires_at = NULL
            WHERE ip_address = %s
        """
        params = [ip_address]
        return bool(Database.execute_sql(sql, params))
    


class UserIpAddressRepository:

    @staticmethod
    def create_user_ip_address_link(
        user_id: int,
        ip_address_id: int,
        is_primary: bool = False
    ) -> Optional[int]:
        """
        Creates a new link between a user and an IP address.
        If the link already exists, it updates the usage_count and last_used.
        Returns the ID of the new/updated link or None.
        """
        # First, try to find an existing link
        existing_link = UserIpAddressRepository.get_user_ip_address_link(user_id, ip_address_id)

        if existing_link:
            # Update existing link
            sql = """
                UPDATE userIpAddresses
                SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                WHERE userId = %s AND ipAddressId = %s
            """
            params = [user_id, ip_address_id]
            Database.execute_sql(sql, params)
            return existing_link['id']
        else:
            # Create new link
            sql = """
                INSERT INTO userIpAddresses (userId, ipAddressId, is_primary, usage_count)
                VALUES (%s, %s, %s, %s)
            """
            params = [user_id, ip_address_id, is_primary, 1] # Start with 1 usage
            return Database.execute_sql(sql, params)

    @staticmethod
    def get_user_ip_address_link(user_id: int, ip_address_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetches a specific link between a user and an IP address.
        """
        sql = "SELECT * FROM userIpAddresses WHERE userId = %s AND ipAddressId = %s"
        params = [user_id, ip_address_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_user_ip_addresses(user_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all IP addresses associated with a specific user,
        joining with the ipAddresses table to get IP details.
        """
        sql = """
            SELECT uia.*, ip.ip_address, ip.is_banned, ip.ban_reason, ip.ban_date, ip.ban_expires_at
            FROM userIpAddresses uia
            JOIN ipAddresses ip ON uia.ipAddressId = ip.id
            WHERE uia.userId = %s
            ORDER BY uia.last_used DESC
        """
        params = [user_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_users_by_ip_address(ip_address_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all users associated with a specific IP address,
        joining with the users table to get user details.
        """
        sql = """
            SELECT uia.*, u.first_name, u.last_name, u.rfid_code, u.userRoleId
            FROM userIpAddresses uia
            JOIN users u ON uia.userId = u.id
            WHERE uia.ipAddressId = %s
            ORDER BY uia.last_used DESC
        """
        params = [ip_address_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def set_primary_ip_address(user_id: int, ip_address_id: int) -> bool:
        """
        Sets a specific IP address as the primary for a user,
        and unsets all other primary IPs for that user.
        """
        # Start a transaction (if Database supports it directly, otherwise handle in SQL)
        # For simplicity, we'll run two separate queries.
        # A more robust solution might wrap this in a single transaction if Database had transaction context manager.

        # 1. Unset all primary IPs for the user
        sql_unset_primary = "UPDATE userIpAddresses SET is_primary = FALSE WHERE userId = %s"
        Database.execute_sql(sql_unset_primary, [user_id])

        # 2. Set the target IP as primary
        sql_set_primary = "UPDATE userIpAddresses SET is_primary = TRUE WHERE userId = %s AND ipAddressId = %s"
        params_set_primary = [user_id, ip_address_id]
        return bool(Database.execute_sql(sql_set_primary, params_set_primary))

    @staticmethod
    def update_user_ip_address_link(
        link_id: int,
        is_primary: Optional[bool] = None,
        usage_count: Optional[int] = None,
        first_used: Optional[datetime] = None,
        last_used: Optional[datetime] = None
    ) -> bool:
        """
        Updates an existing user-IP link's information.
        Returns True if the update was successful, False otherwise.
        """
        set_clauses = []
        params = []

        if is_primary is not None:
            set_clauses.append("is_primary = %s")
            params.append(is_primary)
        if usage_count is not None:
            set_clauses.append("usage_count = %s")
            params.append(usage_count)
        if first_used is not None:
            set_clauses.append("first_used = %s")
            params.append(first_used)
        if last_used is not None:
            set_clauses.append("last_used = %s")
            params.append(last_used)

        if not set_clauses:
            return False # Nothing to update

        sql = f"UPDATE userIpAddresses SET {', '.join(set_clauses)} WHERE id = %s"
        params.append(link_id)
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def delete_user_ip_address_link(link_id: int) -> bool:
        """
        Deletes a specific user-IP link by its ID.
        Returns True if deletion was successful, False otherwise.
        """
        sql = "DELETE FROM userIpAddresses WHERE id = %s"
        params = [link_id]
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def delete_user_ip_address_link_by_user_and_ip(user_id: int, ip_address_id: int) -> bool:
        """
        Deletes a specific user-IP link by user ID and IP address ID.
        Returns True if deletion was successful, False otherwise.
        """
        sql = "DELETE FROM userIpAddresses WHERE userId = %s AND ipAddressId = %s"
        params = [user_id, ip_address_id]
        return bool(Database.execute_sql(sql, params))
    

class QuizSessionRepository:
    @staticmethod
    def create_session(
        session_date: datetime,
        name: str,
        description: Optional[str],
        session_status_id: int,  # Using snake_case for Python consistency
        theme_id: int,           # Using snake_case
        host_user_id: int,       # Using snake_case
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Optional[int]:
        """
        Creates a new quiz session in the database.
        Returns the ID of the newly created session, or None if creation fails.
        """
        sql = """
            INSERT INTO quizSessions 
                (session_date, name, description, sessionStatusId, themeId, hostUserId, start_time, end_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            session_date,
            name,
            description,
            session_status_id,  # Python snake_case
            theme_id,          # Python snake_case
            host_user_id,      # Python snake_case
            start_time if start_time is not None else session_date,
            end_time
        ]
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_session_by_id(session_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetches a single quiz session by its ID.
        """
        sql = """
            SELECT id, session_date, name, description, sessionStatusId, themeId, hostUserId, start_time, end_time
            FROM quizSessions
            WHERE id = %s
        """
        params = [session_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_all_sessions() -> List[Dict[str, Any]]:
        """
        Fetches all quiz sessions from the database.
        """
        sql = """
            SELECT id, session_date, name, description, sessionStatusId, themeId, hostUserId, start_time, end_time
            FROM quizSessions
            ORDER BY session_date DESC, start_time DESC
        """
        return Database.get_all_rows(sql)

    @staticmethod
    def get_sessions_by_status(status_id: int) -> List[Dict[str, Any]]:
        sql = """
            SELECT id, session_date, name, description, sessionStatusId, themeId, hostUserId, start_time, end_time
            FROM quizSessions
            WHERE sessionStatusId = %s
            ORDER BY session_date DESC, start_time DESC
        """
        params = (status_id,)
        
        try:
            sessions = Database.get_all_rows(sql, params)
            return sessions
        except Exception as e:
            print(f"Error in QuizSession.get_sessions_by_status: {e}")
            return []

    @staticmethod
    def get_active_sessions() -> List[Dict[str, Any]]:
        """
        Fetches all currently active quiz sessions (sessionStatusId = 2).
        """
        return QuizSessionRepository.get_sessions_by_status(2) # 2 is active

    @staticmethod
    def update_session(
        session_id: int,
        session_date: datetime,
        name: str,
        description: Optional[str],
        session_status_id: int,
        theme_id: int,
        host_user_id: int,
        start_time: Optional[datetime],
        end_time: Optional[datetime]
    ) -> bool:
        """
        Updates an existing quiz session.
        Returns True if the update was successful, False otherwise.
        """
        sql = """
            UPDATE quizSessions
            SET session_date = %s, name = %s, description = %s, sessionStatusId = %s,
                themeId = %s, hostUserId = %s, start_time = %s, end_time = %s
            WHERE id = %s
        """
        params = [
            session_date,
            name,
            description,
            session_status_id,
            theme_id,
            host_user_id,
            start_time,
            end_time,
            session_id
        ]
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def delete_session(session_id: int) -> bool:
        """
        Deletes a quiz session by its ID.
        Returns True if deletion was successful, False otherwise.
        """
        sql = "DELETE FROM quizSessions WHERE id = %s"
        params = [session_id]
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def update_session_status(session_id: int, new_status_id: int) -> bool:
        """
        Updates only the status of a quiz session.
        Optionally sets end_time if status is 'complete' (3) or 'canceled' (4).
        """
        if new_status_id in [3, 4]: # Complete or Canceled
            sql = "UPDATE quizSessions SET sessionStatusId = %s, end_time = %s WHERE id = %s"
            params = [new_status_id, datetime.now(), session_id]
        else:
            sql = "UPDATE quizSessions SET sessionStatusId = %s WHERE id = %s"
            params = [new_status_id, session_id]
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def set_session_active(session_id: int) -> bool:
        """Sets session status to 'active' (2) and sets start_time if not already set."""
        session_info = QuizSessionRepository.get_session_by_id(session_id)
        if session_info and session_info['start_time'] is None:
             sql = "UPDATE quizSessions SET sessionStatusId = 2, start_time = %s WHERE id = %s"
             params = [datetime.now(), session_id]
        else:
            sql = "UPDATE quizSessions SET sessionStatusId = 2 WHERE id = %s"
            params = [session_id]
        return bool(Database.execute_sql(sql, params))

    @staticmethod
    def set_session_complete(session_id: int) -> bool:
        """Sets session status to 'complete' (3) and records end_time."""
        return QuizSessionRepository.update_session_status(session_id, 3)

    @staticmethod
    def set_session_canceled(session_id: int) -> bool:
        """Sets session status to 'canceled' (4) and records end_time."""
        return QuizSessionRepository.update_session_status(session_id, 4)

    @staticmethod
    def set_session_pending(session_id: int) -> bool:
        """Sets session status to 'pending' (1)."""
        return QuizSessionRepository.update_session_status(session_id, 1)
    
    @staticmethod
    def update_session_theme(session_id: int, theme_id: int) -> bool:
        """Update the theme for a specific session."""
        sql = """
            UPDATE quizSessions 
            SET themeId = %s 
            WHERE id = %s
        """
        params = (theme_id, session_id)
        
        try:
            result = Database.execute_sql(sql, params)
            return result > 0
        except Exception as e:
            logger.error(f"Error updating session theme: {e}")
            return False
    
    


class SensorDataRepository:
    # CREATE operations
    @staticmethod
    def create_sensor_data(sessionId, temperature=None, lightIntensity=None, servoPosition=None, timestamp=None):
        sql = """
        INSERT INTO sensorData 
        (sessionId, `temperature (°C)`, `lightIntensity (lux)`, `servoPosition (°)`, timestamp) 
        VALUES (%s, %s, %s, %s, %s)
        """
        params = [sessionId, temperature, lightIntensity, servoPosition, timestamp]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_all_data_for_session(session_id, limit=None):
        # This SQL query correctly asks the database for the *newest* records first
        # due to "ORDER BY timestamp DESC" and then limits them.
        sql = "SELECT * FROM sensorData WHERE sessionId = %s ORDER BY id DESC LIMIT %s"
        
        # This correctly calculates the number of records to fetch.
        params = [session_id, 1000 if limit is None or not isinstance(limit, int) or limit <= 0 else min(limit, 17725)]
        
        # This calls your database utility to execute the query.
        # The problem lies in what data is actually stored in 'sensorData' for 'sessionId'.
        rows = Database.get_rows(sql, params)
        
        return rows if rows else []
        
    
    @staticmethod
    def get_data_by_id(data_id):
        sql = "SELECT * FROM sensorData WHERE id = %s"
        params = [data_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_temperature_stats_for_session(session_id):
        sql = """
        SELECT 
            MIN(`temperature (°C)`) as min_temp,
            MAX(`temperature (°C)`) as max_temp,
            AVG(`temperature (°C)`) as avg_temp
        FROM sensorData 
        WHERE sessionId = %s
        """
        params = [session_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_light_stats_for_session(session_id):
        sql = """
        SELECT 
            MIN(`lightIntensity (lux)`) as min_light,
            MAX(`lightIntensity (lux)`) as max_light,
            AVG(`lightIntensity (lux)`) as avg_light
        FROM sensorData 
        WHERE sessionId = %s
        """
        params = [session_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_servo_stats_for_session(session_id):
        sql = """
        SELECT 
            MIN(`servoPosition (°)`) as min_servo,
            MAX(`servoPosition (°)`) as max_servo,
            AVG(`servoPosition (°)`) as avg_servo
        FROM sensorData 
        WHERE sessionId = %s
        """
        params = [session_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_data_in_time_range(session_id, start_time, end_time):
        sql = """
        SELECT * FROM sensorData 
        WHERE sessionId = %s AND timestamp BETWEEN %s AND %s
        ORDER BY timestamp ASC
        """
        params = [session_id, start_time, end_time]
        return Database.get_rows(sql, params)
    
    # UPDATE operations (rarely needed for sensor data, but included for completeness)
    @staticmethod
    def update_sensor_reading(data_id, temperature=None, lightIntensity=None, servoPosition=None):
        updates = []
        params = []
        
        if temperature is not None:
            updates.append("`temperature (°C)` = %s")
            params.append(temperature)
        if lightIntensity is not None:
            updates.append("`lightIntensity (lux)` = %s")
            params.append(lightIntensity)
        if servoPosition is not None:
            updates.append("`servoPosition (°)` = %s")
            params.append(servoPosition)
            
        if not updates:
            return False
            
        sql = f"UPDATE sensorData SET {', '.join(updates)} WHERE id = %s"
        params.append(data_id)
        return Database.execute_sql(sql, params)
    
    # DELETE operations (use with caution)
    @staticmethod
    def delete_sensor_reading(data_id):
        sql = "DELETE FROM sensorData WHERE id = %s"
        params = [data_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def delete_all_data_for_session(session_id):
        sql = "DELETE FROM sensorData WHERE sessionId = %s"
        params = [session_id]
        return Database.execute_sql(sql, params)
    





class ItemRepository:
    @staticmethod
    def get_all_items() -> List[Dict[str, Any]]:
        """Get all items."""
        sql = "SELECT * FROM items WHERE is_active = TRUE"
        return Database.execute_sql(sql)
    
    @staticmethod
    def get_item_by_id(item_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific item by ID."""
        sql = "SELECT * FROM items WHERE id = %s AND is_active = TRUE"
        params = [item_id]
        result = Database.execute_sql(sql, params)
        return result[0] if result else None
    
    @staticmethod
    def get_items_by_rarity(rarity: str) -> List[Dict[str, Any]]:
        """Get items by rarity level."""
        sql = "SELECT * FROM items WHERE rarity = %s AND is_active = TRUE"
        params = [rarity]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_items_by_cost_range(min_cost: int = 0, max_cost: int = None) -> List[Dict[str, Any]]:
        """Get items within a cost range."""
        if max_cost is None:
            sql = "SELECT * FROM items WHERE cost >= %s AND is_active = TRUE ORDER BY cost ASC"
            params = [min_cost]
        else:
            sql = "SELECT * FROM items WHERE cost >= %s AND cost <= %s AND is_active = TRUE ORDER BY cost ASC"
            params = [min_cost, max_cost]
        return Database.execute_sql(sql, params)





class PlayerItemRepository:
    @staticmethod
    def get_player_items(user_id: int) -> List[Dict[str, Any]]:
        """Get all items owned by a player with item details."""
        sql = """
            SELECT pi.id, pi.userId, pi.itemId, pi.quantity, pi.acquired_at,
                   i.name, i.description, i.effect, i.effect_value, 
                   i.rarity, i.cost, i.logoUrl
            FROM playerItems pi
            JOIN items i ON pi.itemId = i.id
            WHERE pi.userId = %s AND i.is_active = TRUE
            ORDER BY pi.acquired_at DESC
        """
        params = [user_id]
        result = Database.execute_sql(sql, params)
        # Handle case where Database.execute_sql returns int instead of results
        if isinstance(result, int) or result is None:
            return []
        return result if isinstance(result, list) else []
    
    @staticmethod
    def get_player_item(user_id: int, item_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific item owned by a player."""
        sql = """
            SELECT pi.id, pi.userId, pi.itemId, pi.quantity, pi.acquired_at,
                   i.name, i.description, i.effect, i.effect_value, 
                   i.rarity, i.cost, i.logoUrl
            FROM playerItems pi
            JOIN items i ON pi.itemId = i.id
            WHERE pi.userId = %s AND pi.itemId = %s AND i.is_active = TRUE
        """
        params = [user_id, item_id]
        result = Database.execute_sql(sql, params)
        # Handle case where Database.execute_sql returns int instead of results
        if isinstance(result, int) or result is None or not isinstance(result, list):
            return None
        return result[0] if len(result) > 0 else None
    
    @staticmethod
    def add_item_to_player(user_id: int, item_id: int, quantity: int = 1) -> Optional[int]:
        """Add an item to a player's inventory or increase quantity if already owned."""
        try:
            # Check if player already has this item
            existing_item = PlayerItemRepository.get_player_item(user_id, item_id)
            
            if existing_item:
                # Update quantity
                sql = """
                    UPDATE playerItems 
                    SET quantity = quantity + %s 
                    WHERE userId = %s AND itemId = %s
                """
                params = [quantity, user_id, item_id]
                Database.execute_sql(sql, params)
                return existing_item['id']
            else:
                # Create new entry with explicit acquired_at
                sql = """
                    INSERT INTO playerItems (userId, itemId, quantity, acquired_at)
                    VALUES (%s, %s, %s, NOW())
                """
                params = [user_id, item_id, quantity]
                result = Database.execute_sql(sql, params)
                
                # If Database.execute_sql doesn't return the insert ID, get it manually
                if isinstance(result, int) and result > 0:
                    return result
                else:
                    # Try to get the most recently inserted record
                    get_sql = """
                        SELECT id FROM playerItems 
                        WHERE userId = %s AND itemId = %s 
                        ORDER BY acquired_at DESC, id DESC 
                        LIMIT 1
                    """
                    get_params = [user_id, item_id]
                    get_result = Database.execute_sql(get_sql, get_params)
                    if isinstance(get_result, list) and len(get_result) > 0:
                        return get_result[0]['id']
                    return None
                    
        except Exception as e:
            print(f"Error adding item to player: {e}")
            return None
    
    @staticmethod
    def use_item(user_id: int, item_id: int, quantity: int = 1) -> bool:
        """Use an item (decrease quantity) and return True if successful."""
        try:
            existing_item = PlayerItemRepository.get_player_item(user_id, item_id)
            
            if not existing_item or existing_item['quantity'] < quantity:
                return False
            
            new_quantity = existing_item['quantity'] - quantity
            
            if new_quantity <= 0:
                # Remove item from inventory
                sql = "DELETE FROM playerItems WHERE userId = %s AND itemId = %s"
                params = [user_id, item_id]
            else:
                # Update quantity
                sql = "UPDATE playerItems SET quantity = %s WHERE userId = %s AND itemId = %s"
                params = [new_quantity, user_id, item_id]
            
            Database.execute_sql(sql, params)
            return True
            
        except Exception as e:
            print(f"Error using item: {e}")
            return False
    
    @staticmethod
    def get_player_item_count(user_id: int, item_id: int) -> int:
        """Get the quantity of a specific item a player owns."""
        try:
            item = PlayerItemRepository.get_player_item(user_id, item_id)
            return item['quantity'] if item else 0
        except Exception as e:
            print(f"Error getting player item count: {e}")
            return 0
    
    @staticmethod
    def delete_all_player_items(user_id: int) -> bool:
        """Delete all items from a player's inventory"""
        try:
            sql = "DELETE FROM playerItems WHERE userId = %s"
            params = [user_id]
            Database.execute_sql(sql, params)
            return True
        except Exception as e:
            print(f"Error deleting player items: {e}")
            return False

    @staticmethod
    def debug_insert_test(user_id: int, item_id: int, quantity: int = 1) -> Dict[str, Any]:
        """Test insertion method for diagnostics (debug prints removed for production)."""
        try:
            # First check if the item exists in the items table
            item_check_sql = "SELECT id, name, is_active FROM items WHERE id = %s"
            item_check_result = Database.execute_sql(item_check_sql, [item_id])
            
            if not item_check_result or (isinstance(item_check_result, list) and len(item_check_result) == 0):
                return {"error": "Item does not exist", "item_id": item_id}
            
            # Try the insert
            sql = """
                INSERT INTO playerItems (userId, itemId, quantity, acquired_at)
                VALUES (%s, %s, %s, NOW())
            """
            params = [user_id, item_id, quantity]
            
            result = Database.execute_sql(sql, params)
            
            # Verify the insert by checking the table
            verify_sql = "SELECT * FROM playerItems WHERE userId = %s AND itemId = %s"
            verify_result = Database.execute_sql(verify_sql, [user_id, item_id])
            
            return {
                "insert_result": result,
                "verification": verify_result,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"debug_insert_test failed: {e}")
            return {"error": str(e), "success": False}







# Enhanced Repository Method with Debug Logging
import logging
logger = logging.getLogger(__name__)

class AuditLogRepository:
    @staticmethod
    def create_audit_log(
        table_name: str,
        record_id: int,
        action: str,
        old_values: Dict[str, Any] = None,
        new_values: Dict[str, Any] = None,
        changed_by: int = None,
        ip_address: str = None
    ) -> Optional[int]:
        """Create a new audit log entry."""
        sql = """
            INSERT INTO auditLog (table_name, record_id, action, old_values, new_values, changed_by, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            table_name,
            record_id,
            action,
            json.dumps(old_values) if old_values else None,
            json.dumps(new_values) if new_values else None,
            changed_by,
            ip_address
        ]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_audit_logs_by_table(table_name: str, record_id: int = None) -> List[Dict[str, Any]]:
        """Get audit logs for a specific table and optionally a specific record."""
        if record_id:
            sql = "SELECT * FROM auditLog WHERE table_name = %s AND record_id = %s ORDER BY id DESC"
            params = [table_name, record_id]
        else:
            sql = "SELECT * FROM auditLog WHERE table_name = %s ORDER BY id DESC"
            params = [table_name]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_audit_logs_by_user(changed_by: int) -> List[Dict[str, Any]]:
        """Get all audit logs for actions performed by a specific user."""
        sql = "SELECT * FROM auditLog WHERE changed_by = %s ORDER BY id DESC"
        params = [changed_by]
        return Database.execute_sql(sql, params)
    

    @staticmethod
    def get_recent_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
        """Get the most recent audit log entries."""
        try:
            logger.info(f"Fetching recent audit logs with limit: {limit}")
            
            sql = """
            SELECT id, table_name, record_id, action, old_values, new_values, changed_by, ip_address
            FROM auditLog
            ORDER BY id DESC
            LIMIT %s
            """
            
            params = [limit]
            logger.debug(f"SQL: {sql}")
            
            result = Database.execute_sql(sql, params)
            logger.debug(f"Raw result type: {type(result)}")
            logger.debug(f"Raw result value: {result}")
            
            # Check if result is an integer (rows affected) instead of actual data
            if isinstance(result, int):
                logger.error(f"Database.execute_sql returned int ({result}) instead of query results")
                logger.error("This suggests execute_sql is returning rowcount instead of fetchall() results")
                return []
            
            # Check if result is None
            if result is None:
                logger.warning("Database.execute_sql returned None")
                return []
            
            # Check if result is a list
            if not isinstance(result, list):
                logger.error(f"Database.execute_sql returned unexpected type: {type(result)}")
                return []
            
            logger.info(f"Query successful, returned {len(result)} rows")
            return result
            
        except Exception as e:
            logger.error(f"Error in get_recent_audit_logs: {str(e)}")
            raise








class ChatLogRepository:
    @staticmethod
    def create_chat_message(
        session_id: int,
        message_text: str,
        user_id: int = None,
        message_type: str = 'chat',
        reply_to_id: int = None
    ) -> Optional[int]:
        """Create a new chat message."""
        sql = """
            INSERT INTO chatLog (sessionId, userId, message_text, message_type, reply_to_id)
            VALUES (%s, %s, %s, %s, %s)
        """
        params = [session_id, user_id, message_text, message_type, reply_to_id]
        return Database.execute_sql(sql, params) # Returns last_insert_id or similar

    @staticmethod
    def get_chat_messages_by_session(session_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """Get chat messages for a specific session."""
        sql = """
            SELECT
                c.id,
                c.sessionId,
                c.userId,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as username,
                c.message_text as message,
                c.message_type,
                c.reply_to_id,
                c.is_flagged,
                c.flagged_by,
                c.flagged_reason,
                c.flagged_at,
                c.created_at
            FROM chatLog c
            LEFT JOIN users u ON c.userId = u.id
            WHERE c.sessionId = %s
            ORDER BY c.created_at DESC
            LIMIT %s
        """
        params = [session_id, limit]
        return Database.get_rows(sql, params)

    @staticmethod
    def flag_message(
        message_id: int,
        flagged_by: int,
        flagged_reason: str = None
    ) -> bool:
        """Flag a chat message."""
        sql = """
            UPDATE chatLog 
            SET is_flagged = TRUE, flagged_by = %s, flagged_reason = %s, flagged_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """
        params = [flagged_by, flagged_reason, message_id]
        result = Database.execute_sql(sql, params)
        return result is not None

    @staticmethod
    def unflag_message(message_id: int) -> bool:
        """Unflag a chat message."""
        sql = """
            UPDATE chatLog 
            SET is_flagged = FALSE, flagged_by = NULL, flagged_reason = NULL, flagged_at = NULL
            WHERE id = %s
        """
        params = [message_id]
        result = Database.execute_sql(sql, params)
        return result is not None

    @staticmethod
    def get_flagged_messages(session_id: int = None) -> List[Dict[str, Any]]:
        """Get all flagged messages, optionally filtered by session."""
        if session_id:
            sql = """
                SELECT 
                    cl.*, 
                    COALESCE(CONCAT(u1.first_name, ' ', u1.last_name), 'Unknown') as sender_username,
                    COALESCE(CONCAT(u2.first_name, ' ', u2.last_name), 'N/A') as flagger_username
                FROM chatLog cl
                LEFT JOIN users u1 ON cl.userId = u1.id
                LEFT JOIN users u2 ON cl.flagged_by = u2.id
                WHERE cl.is_flagged = TRUE AND cl.sessionId = %s
                ORDER BY cl.flagged_at DESC
            """
            params = [session_id]
        else:
            sql = """
                SELECT 
                    cl.*, 
                    COALESCE(CONCAT(u1.first_name, ' ', u1.last_name), 'Unknown') as sender_username,
                    COALESCE(CONCAT(u2.first_name, ' ', u2.last_name), 'N/A') as flagger_username
                FROM chatLog cl
                LEFT JOIN users u1 ON cl.userId = u1.id
                LEFT JOIN users u2 ON cl.flagged_by = u2.id
                WHERE cl.is_flagged = TRUE
                ORDER BY cl.flagged_at DESC
            """
            params = []
        return Database.get_rows(sql, params)

    @staticmethod
    def delete_message(message_id: int) -> bool:
        """Delete a chat message."""
        sql = "DELETE FROM chatLog WHERE id = %s"
        params = [message_id]
        result = Database.execute_sql(sql, params)
        return result is not None

    @staticmethod
    def get_user_message_count(user_id: int, session_id: int) -> int:
        """Get the number of messages a user has sent in a session."""
        sql = "SELECT COUNT(*) as count FROM chatLog WHERE userId = %s AND sessionId = %s"
        params = [user_id, session_id]
        result = Database.execute_sql(sql, params)
        return result[0]['count'] if result and result[0] else 0

    @staticmethod
    def get_chat_message_by_id(message_id: int) -> Optional[Any]: # Changed return type to Any or tuple
        """Get a chat message by its ID."""
        sql = """
            SELECT 
                c.*,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as username
            FROM chatLog c
            LEFT JOIN users u ON c.userId = u.id
            WHERE c.id = %s
        """
        params = [message_id]
        result = Database.get_one_row(sql, params)
        return result

    @staticmethod
    def get_messages_by_user_in_session(session_id: int, user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all messages from a specific user in a session."""
        sql = """
            SELECT 
                c.id,
                c.sessionId,
                c.userId,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as username,
                c.message_text as message,
                c.message_type,
                c.reply_to_id,
                c.is_flagged,
                c.flagged_by,
                c.flagged_reason,
                c.flagged_at,
                c.created_at
            FROM chatLog c
            LEFT JOIN users u ON c.userId = u.id
            WHERE c.sessionId = %s AND c.userId = %s
            ORDER BY c.created_at DESC
            LIMIT %s
        """
        params = [session_id, user_id, limit]
        return Database.get_rows(sql, params)

    @staticmethod
    def update_message_text(message_id: int, new_text: str) -> bool:
        """Update the text of a chat message."""
        sql = "UPDATE chatLog SET message_text = %s WHERE id = %s"
        params = [new_text, message_id]
        result = Database.execute_sql(sql, params)
        return result is not None

    @staticmethod
    def get_replies_to_message(message_id: int) -> List[Dict[str, Any]]:
        """Get all replies to a specific message."""
        sql = """
            SELECT 
                c.id,
                c.sessionId,
                c.userId,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as username,
                c.message_text as message,
                c.message_type,
                c.reply_to_id,
                c.is_flagged,
                c.flagged_by,
                c.flagged_reason,
                c.flagged_at,
                c.created_at
            FROM chatLog c
            LEFT JOIN users u ON c.userId = u.id
            WHERE c.reply_to_id = %s
            ORDER BY c.created_at ASC
        """
        params = [message_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_chat_statistics(session_id: int) -> Dict[str, Any]:
        """
        Get various chat statistics for a specific session.
        Returns total messages, messages by user, and messages by type.
        """
        stats = {
            "total_messages": 0,
            "messages_by_user": [],
            "messages_by_type": [],
            "flagged_messages_count": 0
        }

        # Query 1: Total messages
        sql_total_messages = "SELECT COUNT(*) as total FROM chatLog WHERE sessionId = %s"
        total_result = Database.get_one_row(sql_total_messages, [session_id])
        if total_result:
            stats["total_messages"] = total_result.get('total', 0)

        # Query 2: Messages by user
        sql_messages_by_user = """
            SELECT 
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as username, 
                c.userId,
                COUNT(c.id) as message_count
            FROM chatLog c
            LEFT JOIN users u ON c.userId = u.id
            WHERE c.sessionId = %s
            GROUP BY c.userId, username
            ORDER BY message_count DESC
        """
        user_messages = Database.get_rows(sql_messages_by_user, [session_id])
        stats["messages_by_user"] = user_messages if user_messages else []

        # Query 3: Messages by type
        sql_messages_by_type = """
            SELECT 
                message_type, 
                COUNT(id) as message_count
            FROM chatLog
            WHERE sessionId = %s
            GROUP BY message_type
            ORDER BY message_count DESC
        """
        type_messages = Database.get_rows(sql_messages_by_type, [session_id])
        stats["messages_by_type"] = type_messages if type_messages else []

        # Query 4: Flagged messages count
        sql_flagged_count = "SELECT COUNT(*) as count FROM chatLog WHERE sessionId = %s AND is_flagged = TRUE"
        flagged_count_result = Database.get_one_row(sql_flagged_count, [session_id])
        if flagged_count_result:
            stats["flagged_messages_count"] = flagged_count_result.get('count', 0)

        return stats



class SessionPlayerRepository:
    @staticmethod
    def add_player_to_session(session_id: int, user_id: int) -> Optional[int]:
        """Add a player to a quiz session."""
        sql = """
            INSERT INTO sessionPlayers (sessionId, userId)
            VALUES (%s, %s)
        """
        params = [session_id, user_id]
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_session_players(session_id: int):
        try:
            sql = "SELECT userId FROM sessionPlayers WHERE sessionId = %s"
            params = [session_id]
            results = Database.get_rows(sql, params)
            return results if results else None
        except Exception as e:
            logger.error(f"Error getting session players: {e}")
            return None

    @staticmethod
    def get_session_player(session_id: int, user_id: int):
        try:
            sql = "SELECT * FROM sessionPlayers WHERE sessionId = %s AND userId = %s"
            params = [session_id, user_id]
            # Use get_rows instead of get_one, then take first result
            results = Database.get_rows(sql, params)
            return results[0] if results else None
        except Exception as e:
            logger.error(f"Error getting session player: {e}")
            return None

    @staticmethod
    def get_player_sessions(user_id: int) -> List[Dict[str, Any]]:
        """Get all sessions a player has participated in."""
        sql = """
            SELECT sp.*, qs.name as session_name, qs.sessionStatusId, qs.start_time as session_created
            FROM sessionPlayers sp
            JOIN quizSessions qs ON sp.sessionId = qs.id
            WHERE sp.userId = %s AND sp.is_active = TRUE
            ORDER BY sp.joinedAt DESC
        """
        params = [user_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def update_player_score(
        session_id: int, 
        user_id: int, 
        points_to_add: int = 0,
        is_correct: bool = None,
        bonus_points: int = 0,
        time_bonus: int = 0
    ) -> bool:
        """Update a player's score and stats."""
        # Build the SQL dynamically based on what needs to be updated
        updates = ["score = score + %s"]
        params = [points_to_add]
        
        if bonus_points > 0:
            updates.append("bonus_points = bonus_points + %s")
            params.append(bonus_points)
        
        if time_bonus > 0:
            updates.append("time_bonus = time_bonus + %s")
            params.append(time_bonus)
        
        if is_correct is not None:
            if is_correct:
                updates.append("correctAnswers = correctAnswers + 1")
                updates.append("streak_count = streak_count + 1")
            else:
                updates.append("wrongAnswers = wrongAnswers + 1")
                updates.append("streak_count = 0")
        
        sql = f"""
            UPDATE sessionPlayers 
            SET {', '.join(updates)}
            WHERE sessionId = %s AND userId = %s AND is_active = TRUE
        """
        params.extend([session_id, user_id])
        
        result = Database.execute_sql(sql, params)
        return result is not None

    @staticmethod
    def increment_correct_answer(session_id: int, user_id: int, points: int = 0) -> bool:
        """Increment correct answers and update streak."""
        return SessionPlayerRepository.update_player_score(
            session_id, user_id, points, is_correct=True
        )

    @staticmethod
    def increment_wrong_answer(session_id: int, user_id: int) -> bool:
        """Increment wrong answers and reset streak."""
        return SessionPlayerRepository.update_player_score(
            session_id, user_id, 0, is_correct=False
        )

    @staticmethod
    def add_bonus_points(session_id: int, user_id: int, bonus_points: int) -> bool:
        """Add bonus points to a player."""
        return SessionPlayerRepository.update_player_score(
            session_id, user_id, bonus_points, bonus_points=bonus_points
        )

    @staticmethod
    def add_time_bonus(session_id: int, user_id: int, time_bonus: int) -> bool:
        """Add time bonus points to a player."""
        return SessionPlayerRepository.update_player_score(
            session_id, user_id, time_bonus, time_bonus=time_bonus
        )

    @staticmethod
    def get_session_leaderboard(session_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the top players for a session (leaderboard)."""
        sql = """
            SELECT sp.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unknown User') as username, u.email,
                    RANK() OVER (ORDER BY sp.score DESC, sp.correctAnswers DESC, sp.streak_count DESC) as rank_position
            FROM sessionPlayers sp
            JOIN users u ON sp.userId = u.id
            WHERE sp.sessionId = %s AND sp.is_active = TRUE
            ORDER BY sp.score DESC, sp.correctAnswers DESC, sp.streak_count DESC
            LIMIT %s
        """
        params = [session_id, limit]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_player_rank(session_id: int, user_id: int) -> Optional[int]:
        """Get a player's rank in a session."""
        sql = """
            SELECT rank_position FROM (
                SELECT userId,
                        RANK() OVER (ORDER BY score DESC, correctAnswers DESC, streak_count DESC) as rank_position
                FROM sessionPlayers
                WHERE sessionId = %s AND is_active = TRUE
            ) ranked
            WHERE userId = %s
        """
        params = [session_id, user_id]
        result = Database.get_one(sql, params) # Assuming get_one for single result
        return result['rank_position'] if result else None

    @staticmethod
    def remove_player_from_session(session_id: int, user_id: int) -> bool:
        """Mark a player as inactive in a session (soft delete)."""
        sql = """
            UPDATE sessionPlayers 
            SET is_active = FALSE 
            WHERE sessionId = %s AND userId = %s
        """
        params = [session_id, user_id]
        result = Database.execute_sql(sql, params)
        return result is not None

    @staticmethod
    def get_session_stats(session_id: int) -> Dict[str, Any]:
        """Get overall statistics for a session."""
        sql = """
            SELECT 
                COUNT(*) as total_players,
                AVG(score) as avg_score,
                MAX(score) as highest_score,
                MIN(score) as lowest_score,
                SUM(correctAnswers) as total_correct,
                SUM(wrongAnswers) as total_wrong,
                MAX(streak_count) as longest_streak
            FROM sessionPlayers 
            WHERE sessionId = %s AND is_active = TRUE
        """
        params = [session_id]
        result = Database.get_one(sql, params) # Assuming get_one for single result
        return result if result else {}









class PlayerAnswerRepository:

    # CREATE operations
    @staticmethod
    def create_player_answer(session_id, user_id, question_id, answer_id, is_correct, points_earned=0, time_taken=None):
        sql = """
            INSERT INTO playerAnswers 
            (sessionId, userId, questionId, answerId, is_correct, points_earned, time_taken) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            answerId = VALUES(answerId),
            is_correct = VALUES(is_correct),
            points_earned = VALUES(points_earned),
            time_taken = VALUES(time_taken)
        """
        params = [session_id, user_id, question_id, answer_id, is_correct, points_earned, time_taken]
        return Database.execute_sql(sql, params)

    # READ operations
    @staticmethod
    def get_player_answer_by_id(player_answer_id):
        sql = "SELECT * FROM playerAnswers WHERE id = %s"
        params = [player_answer_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_all_player_answers_for_session(session_id):
        sql = "SELECT * FROM playerAnswers WHERE sessionId = %s ORDER BY answered_at ASC"
        params = [session_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_player_answers_for_user_in_session(session_id, user_id):
        sql = "SELECT * FROM playerAnswers WHERE sessionId = %s AND userId = %s ORDER BY answered_at ASC"
        params = [session_id, user_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_player_answers_for_user_in_session_by_question(session_id, user_id, question_id):
        sql = "SELECT * FROM playerAnswers WHERE sessionId = %s AND userId = %s AND questionId = %s ORDER BY answered_at ASC"
        params = [session_id, user_id, question_id]
        return Database.get_rows(sql, params)


    @staticmethod
    def get_player_answers_for_session(session_id):
        sql = "SELECT questionId FROM playerAnswers WHERE sessionId = %s ORDER BY answered_at ASC"
        params = [session_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_player_answers_for_session_for_question(session_id, question_id):
        sql = "SELECT questionId FROM playerAnswers WHERE sessionId = %s AND questionId = %s ORDER BY answered_at ASC"
        params = [session_id,question_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_answer_count_for_question(session_id: int, question_id: int) -> int:
        """
        Get the count of answers for a specific question in a session.
        
        Args:
            session_id: ID of the session
            question_id: ID of the question
            
        Returns:
            int: Count of answers (0 if no answers or error occurs)
        """
        try:
            sql = "SELECT COUNT(*) as answer_count FROM playerAnswers WHERE sessionId = %s AND questionId = %s"
            params = [session_id, question_id]
            result = Database.get_rows(sql, params)
            return result[0]['answer_count'] if result else 0
        except Exception as e:
            logger.error(f"Error getting answer count for session {session_id}, question {question_id}: {e}")
            return 0

    @staticmethod
    def get_player_answers_count_for_question(question_id):
        sql = "SELECT COUNT(*) as count FROM playerAnswers WHERE questionId = %s"
        params = [question_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0

    @staticmethod
    def get_correct_player_answers_count_for_question(question_id):
        sql = "SELECT COUNT(*) as count FROM playerAnswers WHERE questionId = %s AND is_correct = TRUE"
        params = [question_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0

    @staticmethod
    def get_total_points_earned_by_user_in_session(session_id, user_id):
        sql = "SELECT SUM(points_earned) as total_points FROM playerAnswers WHERE sessionId = %s AND userId = %s"
        params = [session_id, user_id]
        result = Database.get_one_row(sql, params)
        return result['total_points'] if result and result['total_points'] is not None else 0

    # UPDATE operations
    @staticmethod
    def update_player_answer(player_answer_id, answer_id=None, is_correct=None, points_earned=None, time_taken=None):
        sql = "UPDATE playerAnswers SET "
        updates = []
        params = []

        if answer_id is not None:
            updates.append("answerId = %s")
            params.append(answer_id)
        if is_correct is not None:
            updates.append("is_correct = %s")
            params.append(is_correct)
        if points_earned is not None:
            updates.append("points_earned = %s")
            params.append(points_earned)
        if time_taken is not None:
            updates.append("time_taken = %s")
            params.append(time_taken)
        
        if not updates:
            return False  # Nothing to update
            
        sql += ", ".join(updates)
        sql += " WHERE id = %s"
        params.append(player_answer_id)
        
        return Database.execute_sql(sql, params)

    @staticmethod
    def mark_player_answer_correct_status(player_answer_id, is_correct: bool):
        sql = "UPDATE playerAnswers SET is_correct = %s WHERE id = %s"
        params = [is_correct, player_answer_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_player_answer_points_earned(player_answer_id, points_earned):
        sql = "UPDATE playerAnswers SET points_earned = %s WHERE id = %s"
        params = [points_earned, player_answer_id]
        return Database.execute_sql(sql, params)

    # DELETE operations
    @staticmethod
    def delete_player_answer(player_answer_id):
        sql = "DELETE FROM playerAnswers WHERE id = %s"
        params = [player_answer_id]
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_all_player_answers_for_session(session_id):
        sql = "DELETE FROM playerAnswers WHERE sessionId = %s"
        params = [session_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def delete_player_answers_for_user_in_session(session_id, user_id):
        sql = "DELETE FROM playerAnswers WHERE sessionId = %s AND userId = %s"
        params = [session_id, user_id]
        return Database.execute_sql(sql, params)

    @staticmethod
    def delete_player_answers_for_question(question_id):
        sql = "DELETE FROM playerAnswers WHERE questionId = %s"
        params = [question_id]
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_question_with_player_answers(question_id: int, sessionId: int) -> Optional[Dict[str, Any]]:
        """
        Retrieves a question along with all player answers for that question in a specific session,
        including player's first name, last name, and the text of the answer they selected.
        
        Args:
            question_id: ID of the question
            sessionId: ID of the session to filter by
            
        Returns:
            Dictionary containing question data and player answers, or None if question not found
        """
        question = Database.get_one_row("SELECT * FROM questions WHERE id = %s", [question_id])
        if not question:
            return None

        sql = """
            SELECT
                pa.id AS player_answer_id,
                pa.sessionId,
                pa.userId,
                u.first_name,
                u.last_name,
                pa.questionId,
                pa.answerId,
                a.answer_text,
                pa.is_correct,
                pa.points_earned,
                pa.time_taken,
                pa.answered_at
            FROM
                playerAnswers pa
            JOIN
                users u ON pa.userId = u.id
            LEFT JOIN
                answers a ON pa.answerId = a.id
            WHERE
                pa.questionId = %s
                AND pa.sessionId = %s
            ORDER BY
                pa.answered_at ASC;
        """
        player_answers = Database.get_rows(sql, [question_id, sessionId])

        question['player_answers'] = player_answers
        return question
    
    @staticmethod
    def get_all_answers() -> List[Dict[str, Any]]:
        """
        Retrieves all player answers from the database.
        """
        sql = """
            SELECT
                id,
                sessionId,
                userId,
                questionId,
                answerId,
                is_correct,
                points_earned,
                time_taken,
                answered_at
            FROM
                playerAnswers
            ORDER BY
                answered_at ASC;
        """
        return Database.get_rows(sql)
    
    @staticmethod
    def get_correct_answers_percentage() -> int:
        """
        Calculates the percentage of correct answers.
        Returns the percentage as an integer (e.g., 50 for 50%).
        """
        sql = """
            SELECT
                COUNT(*) as total_answers,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
            FROM
                playerAnswers;
        """
        result = Database.get_one_row(sql)
        
        if not result or result['total_answers'] == 0:
            return 0
        
        percentage = (result['correct_answers'] / result['total_answers']) * 100
        return round(percentage)

    @staticmethod
    def get_all_player_answers_for_user_in_session(session_id: int, user_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves all player answers for a specific user within a given session,
        ordered by the time they were answered.

        Args:
            session_id (int): The ID of the session.
            user_id (int): The ID of the user.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries, where each dictionary
                                   represents a player answer. Returns an empty
                                   list if no answers are found.
        """
        sql = """
            SELECT
                id,
                sessionId,
                userId,
                questionId,
                answerId,
                is_correct,
                points_earned,
                time_taken,
                answered_at
            FROM
                playerAnswers
            WHERE
                sessionId = %s AND userId = %s
            ORDER BY
                answered_at ASC;
        """
        params = [session_id, user_id]
        return Database.get_rows(sql, params)

# SCORE operations
    @staticmethod
    def get_total_score_for_session(session_id):
        """
        Calculates the total possible points for a session by summing up all points earned by all players.
        
        Args:
            session_id (int): The ID of the session.
            
        Returns:
            int: Total points earned across all players in the session.
        """
        sql = "SELECT SUM(points_earned) as total_score FROM playerAnswers WHERE sessionId = %s"
        params = [session_id]
        result = Database.get_one_row(sql, params)
        return result['total_score'] if result and result['total_score'] is not None else 0

    @staticmethod
    def get_player_score_for_session(session_id, user_id):
        """
        Calculates the total points earned by a specific player in a session.
        
        Args:
            session_id (int): The ID of the session.
            user_id (int): The ID of the user/player.
            
        Returns:
            int: Total points earned by the player in the session.
        """
        sql = "SELECT SUM(points_earned) as player_score FROM playerAnswers WHERE sessionId = %s AND userId = %s"
        params = [session_id, user_id]
        result = Database.get_one_row(sql, params)
        return result['player_score'] if result and result['player_score'] is not None else 0

    @staticmethod
    def get_all_player_scores_for_session(session_id):
        """
        Gets the scores for all players in a session, including player details.
        
        Args:
            session_id (int): The ID of the session.
            
        Returns:
            List[Dict]: List of dictionaries containing user_id, first_name, last_name, and total_score.
        """
        sql = """
            SELECT 
                pa.userId,
                u.first_name,
                u.last_name,
                SUM(pa.points_earned) as total_score,
                COUNT(pa.id) as total_answers,
                SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
            FROM playerAnswers pa
            JOIN users u ON pa.userId = u.id
            WHERE pa.sessionId = %s
            GROUP BY pa.userId, u.first_name, u.last_name
            ORDER BY total_score DESC
        """
        params = [session_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_session_leaderboard(session_id):
        """
        Gets a ranked leaderboard for a session with player rankings.
        
        Args:
            session_id (int): The ID of the session.
            
        Returns:
            List[Dict]: Ranked list of players with their scores and statistics.
        """
        sql = """
            SELECT 
                ROW_NUMBER() OVER (ORDER BY SUM(pa.points_earned) DESC) as rank,
                pa.userId,
                u.first_name,
                u.last_name,
                SUM(pa.points_earned) as total_score,
                COUNT(pa.id) as total_answers,
                SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
                ROUND((SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id)), 1) as accuracy_percentage
            FROM playerAnswers pa
            JOIN users u ON pa.userId = u.id
            WHERE pa.sessionId = %s
            GROUP BY pa.userId, u.first_name, u.last_name
            ORDER BY total_score DESC, correct_answers DESC
        """
        params = [session_id]
        return Database.get_rows(sql, params)

    @staticmethod
    def get_session_statistics(session_id):
        """
        Gets comprehensive statistics for a session.
        
        Args:
            session_id (int): The ID of the session.
            
        Returns:
            Dict: Dictionary containing session statistics including total score, player count, etc.
        """
        sql = """
            SELECT 
                COUNT(DISTINCT pa.userId) as total_players,
                COUNT(pa.id) as total_answers,
                SUM(pa.points_earned) as total_points_awarded,
                SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) as total_correct_answers,
                AVG(pa.points_earned) as avg_points_per_answer,
                MAX(pa.points_earned) as highest_single_answer_points,
                ROUND((SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id)), 1) as overall_accuracy_percentage
            FROM playerAnswers pa
            WHERE pa.sessionId = %s
        """
        params = [session_id]
        result = Database.get_one_row(sql, params)
        
        if result:
            # Convert None values to 0 for cleaner results
            for key, value in result.items():
                if value is None:
                    result[key] = 0
                    
        return result if result else {
            'total_players': 0,
            'total_answers': 0,
            'total_points_awarded': 0,
            'total_correct_answers': 0,
            'avg_points_per_answer': 0,
            'highest_single_answer_points': 0,
            'overall_accuracy_percentage': 0
        }
    
    @staticmethod
    def check_answer_exists(session_id, user_id, question_id):
        sql = "SELECT 1 FROM playerAnswers WHERE sessionId = %s AND userId = %s AND questionId = %s LIMIT 1"
        params = [session_id, user_id, question_id]
        return bool(Database.get_one_row(sql, params))
    
    @staticmethod
    def get_player_answer_for_question(session_id, user_id, question_id):
        sql = """
            SELECT * FROM playerAnswers 
            WHERE sessionId = %s AND userId = %s AND questionId = %s
            ORDER BY id DESC
            LIMIT 1
        """
        params = [session_id, user_id, question_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_player_answers_count_for_user_in_session(session_id, user_id):
        sql = "SELECT COUNT(*) as count FROM playerAnswers WHERE sessionId = %s AND userId = %s"
        params = [session_id, user_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0

    @staticmethod
    def get_player_global_stats(user_id):
        """
        Gets global statistics for a player across all sessions.
        
        Args:
            user_id (int): The ID of the user/player.
            
        Returns:
            Dict: Dictionary containing total_score, total_answers, correct_answers, sessions_played.
        """
        sql = """
            SELECT 
                SUM(pa.points_earned) as total_score,
                COUNT(pa.id) as total_answers,
                SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
                COUNT(DISTINCT pa.sessionId) as sessions_played
            FROM playerAnswers pa
            WHERE pa.userId = %s
        """
        params = [user_id]
        result = Database.get_one_row(sql, params)
        
        if result:
            # Convert None values to 0
            for key, value in result.items():
                if value is None:
                    result[key] = 0
            return result
        else:
            return {
                'total_score': 0,
                'total_answers': 0,
                'correct_answers': 0,
                'sessions_played': 0
            }


class ArticlesRepository:
    """Repository class for managing articles in the database"""
    
    # CREATE operations
    @staticmethod
    def create_article(title: str, author: str, date_written: str, story: str = None,
                      content: str = "", excerpt: str = None, category: str = "general",
                      tags: str = None, word_count: int = 0, reading_time_minutes: int = 0,
                      is_active: bool = True, is_featured: bool = False,
                      story_id: Optional[int] = None, story_order: int = 0) -> Optional[int]:
        """Create a new article"""
        sql = """
        INSERT INTO articles (title, author, date_written, story, story_id, story_order, content, excerpt,
                            category, tags, word_count, reading_time_minutes, is_active, is_featured)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [title, author, date_written, story, story_id, story_order, content, excerpt,
                 category, tags, word_count, reading_time_minutes, is_active, is_featured]
        return Database.execute_sql(sql, params)
    
    # READ operations
    @staticmethod
    def get_all_articles(active_only: bool = False, include_story_info: bool = False) -> List[Dict[str, Any]]:
        """Get all articles from the database, optionally with story information"""
        if include_story_info:
            sql = """
            SELECT a.*, s.name as story_name, s.slug as story_slug
            FROM articles a
            LEFT JOIN stories s ON a.story_id = s.id
            """
            if active_only:
                sql += " WHERE a.is_active = TRUE"
            sql += " ORDER BY a.created_at DESC"
        else:
            sql = "SELECT * FROM articles"
            if active_only:
                sql += " WHERE is_active = TRUE"
            sql += " ORDER BY created_at DESC"
        return Database.get_rows(sql)
    
    @staticmethod
    def get_article_by_id(article_id: int) -> Optional[Dict[str, Any]]:
        """Get a single article by ID"""
        sql = "SELECT * FROM articles WHERE id = %s"
        params = [article_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_articles_by_author(author: str, active_only: bool = False) -> List[Dict[str, Any]]:
        """Get all articles by a specific author"""
        sql = "SELECT * FROM articles WHERE author = %s"
        params = [author]
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY date_written DESC"
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_articles_by_category(category: str, active_only: bool = False) -> List[Dict[str, Any]]:
        """Get all articles in a specific category"""
        sql = "SELECT * FROM articles WHERE category = %s"
        params = [category]
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY date_written DESC"
        return Database.get_rows(sql, params)

    @staticmethod
    def get_articles_by_story_id(story_id: int, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all articles within a story, ordered by story_order"""
        sql = "SELECT * FROM articles WHERE story_id = %s"
        params = [story_id]
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY story_order ASC, date_written ASC, id ASC"
        return Database.get_rows(sql, params)
    
    @staticmethod
    def search_articles(search_term: str, active_only: bool = False) -> List[Dict[str, Any]]:
        """Search articles using LIKE search"""
        sql = """
        SELECT * FROM articles 
        WHERE (title LIKE %s OR content LIKE %s OR author LIKE %s OR story LIKE %s)
        """
        params = [f"%{search_term}%", f"%{search_term}%", f"%{search_term}%", f"%{search_term}%"]
        if active_only:
            sql += " AND is_active = TRUE"
        sql += " ORDER BY created_at DESC"
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_featured_articles(limit: int = 5) -> List[Dict[str, Any]]:
        """Get featured articles"""
        sql = """
        SELECT * FROM articles 
        WHERE is_featured = TRUE AND is_active = TRUE 
        ORDER BY date_written DESC 
        LIMIT %s
        """
        params = [limit]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_recent_articles(limit: int = 10, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get most recent articles"""
        sql = "SELECT * FROM articles"
        params = [limit]
        if active_only:
            sql += " WHERE is_active = TRUE"
        sql += " ORDER BY created_at DESC LIMIT %s"
        return Database.get_rows(sql, params)
    
    @staticmethod
    def check_article_exists_by_title(title: str, exclude_id: int = None) -> bool:
        """Check if an article with the same title already exists"""
        sql = "SELECT COUNT(*) as count FROM articles WHERE title = %s"
        params = [title]
        
        if exclude_id:
            sql += " AND id != %s"
            params.append(exclude_id)
            
        result = Database.get_one_row(sql, params)
        return result['count'] > 0 if result else False
    
    # UPDATE operations
    @staticmethod
    def update_article(article_id: int, **kwargs) -> bool:
        """Update an article with provided fields"""
        allowed_fields = ['title', 'author', 'date_written', 'story', 'story_id', 'story_order', 'content',
                          'excerpt', 'category', 'tags', 'word_count',
                          'reading_time_minutes', 'is_active', 'is_featured']

        updates = []
        params = []

        for field, value in kwargs.items():
            if field in allowed_fields:
                updates.append(f"{field} = %s")
                params.append(value)

        if not updates:
            return False

        # Add updated_at timestamp
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(article_id)

        sql = f"UPDATE articles SET {', '.join(updates)} WHERE id = %s"
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0

    @staticmethod
    def get_next_story_order(story_id: int) -> int:
        """Return the next story_order index for given story_id (0-based)."""
        sql = "SELECT COALESCE(MAX(story_order), -1) + 1 AS next_order FROM articles WHERE story_id = %s"
        params = [story_id]
        row = Database.get_one_row(sql, params)
        try:
            return int(row.get('next_order', 0)) if row else 0
        except Exception:
            return 0
    
    # STATISTICS operations
    @staticmethod
    def get_articles_stats() -> Dict[str, Any]:
        """Get articles statistics"""
        stats = {}
        
        # Total articles
        sql = "SELECT COUNT(*) as total FROM articles"
        result = Database.get_one_row(sql)
        stats['total_articles'] = result['total'] if result else 0
        
        # Active articles
        sql = "SELECT COUNT(*) as active FROM articles WHERE is_active = TRUE"
        result = Database.get_one_row(sql)
        stats['active_articles'] = result['active'] if result else 0
        
        # Featured articles
        sql = "SELECT COUNT(*) as featured FROM articles WHERE is_featured = TRUE"
        result = Database.get_one_row(sql)
        stats['featured_articles'] = result['featured'] if result else 0
        
        # Articles by category
        sql = """
        SELECT category, COUNT(*) as count 
        FROM articles 
        WHERE is_active = TRUE 
        GROUP BY category 
        ORDER BY count DESC
        """
        stats['by_category'] = Database.get_rows(sql)
        
        # Top authors
        sql = """
        SELECT author, COUNT(*) as count 
        FROM articles 
        WHERE is_active = TRUE 
        GROUP BY author 
        ORDER BY count DESC 
        LIMIT 5
        """
        stats['top_authors'] = Database.get_rows(sql)
        
        # Most viewed articles
        sql = """
        SELECT id, title, view_count 
        FROM articles 
        WHERE is_active = TRUE 
        ORDER BY view_count DESC 
        LIMIT 5
        """
        stats['most_viewed'] = Database.get_rows(sql)
        
        return stats
    
    @staticmethod
    def increment_view_count(article_id: int) -> bool:
        """Increment the view count for an article"""
        sql = "UPDATE articles SET view_count = view_count + 1 WHERE id = %s"
        params = [article_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0


class StoriesRepository:
    """Repository for stories table"""

    @staticmethod
    def create_story(name: str, slug: Optional[str] = None, description: Optional[str] = None) -> Optional[int]:
        sql = """
        INSERT INTO stories (name, slug, description)
        VALUES (%s, %s, %s)
        """
        params = [name, slug, description]
        return Database.execute_sql(sql, params)

    @staticmethod
    def get_story_by_id(story_id: int) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM stories WHERE id = %s"
        params = [story_id]
        return Database.get_one_row(sql, params)

    @staticmethod
    def get_story_by_name(name: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM stories WHERE name = %s"
        params = [name]
        return Database.get_one_row(sql, params)

    @staticmethod
    def list_stories() -> List[Dict[str, Any]]:
        sql = "SELECT * FROM stories ORDER BY name ASC"
        return Database.get_rows(sql)

    @staticmethod
    def delete_story(story_id: int) -> bool:
        sql = "DELETE FROM stories WHERE id = %s"
        params = [story_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0

    @staticmethod
    def update_story(story_id: int, name: Optional[str] = None, description: Optional[str] = None, slug: Optional[str] = None) -> bool:
        """Update a story's name, description, and/or slug."""
        fields = []
        params = []
        if name is not None:
            fields.append("name = %s")
            params.append(name)
        if description is not None:
            fields.append("description = %s")
            params.append(description)
        if slug is not None:
            fields.append("slug = %s")
            params.append(slug)
        if not fields:
            return False
        sql = f"UPDATE stories SET {', '.join(fields)} WHERE id = %s"
        params.append(story_id)
        result = Database.execute_sql(sql, params)
        return result is not None and result >= 0
    
    @staticmethod
    def set_article_active_status(article_id: int, is_active: bool) -> bool:
        """Set article active/inactive status"""
        sql = "UPDATE articles SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        params = [is_active, article_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    @staticmethod
    def set_article_featured_status(article_id: int, is_featured: bool) -> bool:
        """Set article featured status"""
        sql = "UPDATE articles SET is_featured = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        params = [is_featured, article_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    # DELETE operations
    @staticmethod
    def delete_article(article_id: int) -> bool:
        """Delete an article from the database"""
        sql = "DELETE FROM articles WHERE id = %s"
        params = [article_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0


# =============================================================================
# KINGDOM QUARRY GAME REPOSITORIES
# =============================================================================

class GameSaveRepository:
    """Repository for managing Kingdom Quarry game saves"""
    
    @staticmethod
    def create_save(user_id: int, save_data: Dict[str, Any], game_version: str = "1.0.0") -> Optional[int]:
        """Create or update a game save - ensures only ONE save per user"""
        
        # CRITICAL: Delete ALL existing saves for this user first (prevents duplicates)
        delete_sql = "DELETE FROM game_saves WHERE user_id = %s"
        Database.execute_sql(delete_sql, [user_id])
        
        # Now create a fresh save (only one will exist)
        sql = """
        INSERT INTO game_saves (user_id, save_data, game_version, last_updated)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        """
        params = [user_id, json.dumps(save_data), game_version]
        result = Database.execute_sql(sql, params)
        return result
    
    @staticmethod
    def get_save_by_user(user_id: int) -> Optional[Dict[str, Any]]:
        """Get the latest save for a user"""
        sql = """
        SELECT id, user_id, save_data, last_updated, game_version
        FROM game_saves 
        WHERE user_id = %s 
        ORDER BY last_updated DESC 
        LIMIT 1
        """
        params = [user_id]
        result = Database.get_one_row(sql, params)
        if result and result['save_data']:
            result['save_data'] = json.loads(result['save_data'])
        return result
    
    @staticmethod
    def update_save_data(user_id: int, save_data: Dict[str, Any], total_play_time: int = None) -> bool:
        """Update existing save data"""
        if total_play_time is not None:
            sql = """
            UPDATE game_saves 
            SET save_data = %s, last_updated = CURRENT_TIMESTAMP, total_play_time = %s
            WHERE user_id = %s
            """
            params = [json.dumps(save_data), total_play_time, user_id]
        else:
            sql = """
            UPDATE game_saves 
            SET save_data = %s, last_updated = CURRENT_TIMESTAMP
            WHERE user_id = %s
            """
            params = [json.dumps(save_data), user_id]
        
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    @staticmethod
    def create_backup(user_id: int, save_data: Dict[str, Any], version: str = "1.0.0") -> Optional[int]:
        """Create a backup of current save"""
        sql = """
        INSERT INTO save_backups (user_id, save_data, backup_timestamp, version)
        VALUES (%s, %s, CURRENT_TIMESTAMP, %s)
        """
        params = [user_id, json.dumps(save_data), version]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_backups(user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent save backups for a user"""
        sql = """
        SELECT id, user_id, save_data, backup_timestamp, version
        FROM save_backups 
        WHERE user_id = %s 
        ORDER BY backup_timestamp DESC 
        LIMIT %s
        """
        params = [user_id, limit]
        results = Database.get_rows(sql, params)
        for result in results:
            if result['save_data']:
                result['save_data'] = json.loads(result['save_data'])
        return results
    
    @staticmethod
    def cleanup_old_backups(user_id: int, keep_count: int = 10) -> bool:
        """Clean up old backups, keeping only the most recent ones"""
        sql = """
        DELETE FROM save_backups 
        WHERE user_id = %s 
        AND id NOT IN (
            SELECT id FROM (
                SELECT id FROM save_backups 
                WHERE user_id = %s 
                ORDER BY backup_timestamp DESC 
                LIMIT %s
            ) AS recent_backups
        )
        """
        params = [user_id, user_id, keep_count]
        result = Database.execute_sql(sql, params)
        return result is not None


class GameResourcesRepository:
    """Repository for managing Kingdom Quarry resources"""
    
    @staticmethod
    def create_user_resources(user_id: int) -> Optional[int]:
        """Initialize resources for a new user"""
        sql = """
        INSERT INTO user_resources (user_id, stone_count, gold_count, magical_crystals, prestige_level)
        VALUES (%s, 0, 0, 0, 0)
        ON DUPLICATE KEY UPDATE user_id = user_id
        """
        params = [user_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_user_resources(user_id: int) -> Optional[Dict[str, Any]]:
        """Get all resources for a user"""
        sql = """
        SELECT id, user_id, stone_count, gold_count, magical_crystals, prestige_level
        FROM user_resources 
        WHERE user_id = %s
        """
        params = [user_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def update_resources(user_id: int, **kwargs) -> bool:
        """Update specific resource amounts"""
        allowed_fields = ['stone_count', 'gold_count', 'magical_crystals', 'prestige_level']
        updates = []
        params = []
        
        for field, value in kwargs.items():
            if field in allowed_fields:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            return False
        
        sql = f"UPDATE user_resources SET {', '.join(updates)} WHERE user_id = %s"
        params.append(user_id)
        
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    @staticmethod
    def add_resources(user_id: int, stone: int = 0, gold: int = 0, crystals: int = 0) -> bool:
        """Add resources to existing amounts"""
        sql = """
        UPDATE user_resources 
        SET stone_count = stone_count + %s,
            gold_count = gold_count + %s,
            magical_crystals = magical_crystals + %s
        WHERE user_id = %s
        """
        params = [stone, gold, crystals, user_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    @staticmethod
    def spend_resources(user_id: int, stone: int = 0, gold: int = 0, crystals: int = 0) -> bool:
        """Spend resources if user has enough"""
        # First check if user has enough resources
        current = GameResourcesRepository.get_user_resources(user_id)
        if not current:
            return False
        
        if (current['stone_count'] < stone or 
            current['gold_count'] < gold or 
            current['magical_crystals'] < crystals):
            return False
        
        sql = """
        UPDATE user_resources 
        SET stone_count = stone_count - %s,
            gold_count = gold_count - %s,
            magical_crystals = magical_crystals - %s
        WHERE user_id = %s
        """
        params = [stone, gold, crystals, user_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    @staticmethod
    def get_leaderboard(limit: int = 100) -> List[Dict[str, Any]]:
        """Get resource leaderboard"""
        sql = """
        SELECT ur.user_id, u.first_name, u.last_name,
               ur.stone_count, ur.gold_count, ur.magical_crystals, ur.prestige_level,
               (ur.stone_count + ur.gold_count * 10 + ur.magical_crystals * 100) as total_score
        FROM user_resources ur
        JOIN users u ON ur.user_id = u.id
        ORDER BY total_score DESC, prestige_level DESC
        LIMIT %s
        """
        params = [limit]
        return Database.get_rows(sql, params)


class GameUpgradesRepository:
    """Repository for managing Kingdom Quarry upgrades"""
    
    @staticmethod
    def create_user_upgrades(user_id: int) -> Optional[int]:
        """Initialize upgrades for a new user"""
        sql = """
        INSERT INTO user_upgrades (user_id, miner_level, transport_level, market_level, unlocked_vehicles)
        VALUES (%s, 1, 1, 1, %s)
        ON DUPLICATE KEY UPDATE user_id = user_id
        """
        params = [user_id, json.dumps(["hand_cart"])]  # Default starting vehicle
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def get_user_upgrades(user_id: int) -> Optional[Dict[str, Any]]:
        """Get all upgrades for a user"""
        sql = """
        SELECT id, user_id, miner_level, transport_level, market_level, unlocked_vehicles
        FROM user_upgrades 
        WHERE user_id = %s
        """
        params = [user_id]
        result = Database.get_one_row(sql, params)
        if result and result['unlocked_vehicles']:
            result['unlocked_vehicles'] = json.loads(result['unlocked_vehicles'])
        return result
    
    @staticmethod
    def update_upgrade_level(user_id: int, upgrade_type: str, new_level: int) -> bool:
        """Update a specific upgrade level"""
        allowed_upgrades = ['miner_level', 'transport_level', 'market_level']
        if upgrade_type not in allowed_upgrades:
            return False
        
        sql = f"UPDATE user_upgrades SET {upgrade_type} = %s WHERE user_id = %s"
        params = [new_level, user_id]
        result = Database.execute_sql(sql, params)
        return result is not None and result > 0
    
    @staticmethod
    def unlock_vehicle(user_id: int, vehicle_type: str) -> bool:
        """Unlock a new vehicle type"""
        current = GameUpgradesRepository.get_user_upgrades(user_id)
        if not current:
            return False
        
        unlocked = current.get('unlocked_vehicles', [])
        if vehicle_type not in unlocked:
            unlocked.append(vehicle_type)
            
            sql = "UPDATE user_upgrades SET unlocked_vehicles = %s WHERE user_id = %s"
            params = [json.dumps(unlocked), user_id]
            result = Database.execute_sql(sql, params)
            return result is not None and result > 0
        
        return True  # Already unlocked
    
    @staticmethod
    def get_upgrade_stats() -> Dict[str, Any]:
        """Get upgrade statistics across all users"""
        stats = {}
        
        # Average upgrade levels
        sql = """
        SELECT 
            AVG(miner_level) as avg_miner_level,
            AVG(transport_level) as avg_transport_level,
            AVG(market_level) as avg_market_level,
            MAX(miner_level) as max_miner_level,
            MAX(transport_level) as max_transport_level,
            MAX(market_level) as max_market_level
        FROM user_upgrades
        """
        result = Database.get_one_row(sql)
        stats['upgrade_averages'] = result if result else {}
        
        # Most common vehicles
        sql = """
        SELECT user_id, unlocked_vehicles 
        FROM user_upgrades 
        WHERE unlocked_vehicles IS NOT NULL
        """
        results = Database.get_rows(sql)
        vehicle_counts = {}
        
        for result in results:
            if result['unlocked_vehicles']:
                vehicles = json.loads(result['unlocked_vehicles'])
                for vehicle in vehicles:
                    vehicle_counts[vehicle] = vehicle_counts.get(vehicle, 0) + 1
        
        stats['vehicle_popularity'] = sorted(vehicle_counts.items(), key=lambda x: x[1], reverse=True)
        
        return stats


# ──────────────────────────────────────────────────────────────────────
# Support Chat Rooms & Messages
# ──────────────────────────────────────────────────────────────────────

class SupportRoomRepository:
    """Repository for support chat rooms."""

    @staticmethod
    def create_room(name: str, description: str = None, is_private: bool = False, created_by: int = None):
        sql = """INSERT INTO support_rooms (name, description, is_private, created_by)
                 VALUES (%s, %s, %s, %s)"""
        return Database.execute_sql(sql, [name, description, is_private, created_by])

    @staticmethod
    def get_room_by_id(room_id: int):
        sql = "SELECT * FROM support_rooms WHERE id = %s"
        return Database.get_one_row(sql, [room_id])

    @staticmethod
    def get_all_rooms():
        sql = """SELECT r.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as creator_name,
                        (SELECT COUNT(*) FROM support_messages m WHERE m.room_id = r.id) as message_count
                 FROM support_rooms r
                 LEFT JOIN users u ON r.created_by = u.id
                 ORDER BY r.is_private ASC, r.created_at ASC"""
        return Database.get_rows(sql)

    @staticmethod
    def get_rooms_for_user(user_id: int, user_role_id: int = 1):
        """Get rooms visible to a user: all public rooms + private rooms they created.
        Admins (role >= 3) see all rooms."""
        
        # Fetch the user's role directly from the database to ensure accuracy
        user = UserRepository.get_user_by_id(user_id)
        actual_role_id = user['userRoleId'] if user else user_role_id

        if actual_role_id >= 3:
            return SupportRoomRepository.get_all_rooms()
        
        sql = """SELECT r.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as creator_name,
                        (SELECT COUNT(*) FROM support_messages m WHERE m.room_id = r.id) as message_count
                FROM support_rooms r
                LEFT JOIN users u ON r.created_by = u.id
                WHERE r.is_private = FALSE OR r.created_by = %s
                ORDER BY r.is_private ASC, r.created_at ASC"""
        return Database.get_rows(sql, [user_id])

    @staticmethod
    def delete_room(room_id: int):
        sql = "DELETE FROM support_rooms WHERE id = %s"
        return Database.execute_sql(sql, [room_id])


class SupportMessageRepository:
    """Repository for support chat messages."""

    @staticmethod
    def create_message(room_id: int, user_id: int, message_text: str):
        sql = """INSERT INTO support_messages (room_id, user_id, message_text)
                 VALUES (%s, %s, %s)"""
        return Database.execute_sql(sql, [room_id, user_id, message_text])

    @staticmethod
    def get_messages_by_room(room_id: int, limit: int = 200):
        sql = """SELECT m.id, m.room_id, m.user_id, m.message_text, m.created_at,
                        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unknown') as username
                 FROM support_messages m
                 LEFT JOIN users u ON m.user_id = u.id
                 WHERE m.room_id = %s
                 ORDER BY m.created_at ASC
                 LIMIT %s"""
        return Database.get_rows(sql, [room_id, limit])

    @staticmethod
    def delete_message(message_id: int):
        sql = "DELETE FROM support_messages WHERE id = %s"
        return Database.execute_sql(sql, [message_id])