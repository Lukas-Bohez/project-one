from .database import Database
from datetime import datetime,  timedelta
from typing import List, Optional, Dict, Any
import bcrypt

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
        sql = "SELECT * FROM themes ORDER BY name ASC"
        return Database.get_rows(sql)

    @staticmethod
    def get_active_themes():
        sql = "SELECT * FROM themes WHERE is_active = TRUE ORDER BY name ASC"
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

    # DELETE operations
    @staticmethod
    def delete_theme(theme_id: int):
        sql = "DELETE FROM themes WHERE id = %s"
        params = [theme_id]
        return Database.execute_sql(sql, params)
    

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
        sql = "SELECT id, last_name, first_name, rfid_code, userRoleId, soul_points, limb_points, last_active, session_expires_at, updated_by FROM users"
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
            user_data.get('userRoleId', 2), # Default to player role if not provided
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
        session_status_id: int,
        theme_id: int,
        host_user_id: int,
        start_time: Optional[datetime] = None
    ) -> Optional[int]:
        """
        Creates a new quiz session in the database.
        Returns the ID of the newly created session, or None if creation fails.
        """
        sql = """
            INSERT INTO quizSessions (session_date, name, description, sessionStatusId, themeId, hostUserId, start_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            session_date,
            name,
            description,
            session_status_id,
            theme_id,
            host_user_id,
            start_time if start_time is not None else datetime.now()
        ]
        return Database.execute_and_get_last_id(sql, params)

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
        """
        Fetches quiz sessions filtered by their status ID.
        """
        sql = """
            SELECT id, session_date, name, description, sessionStatusId, themeId, hostUserId, start_time, end_time
            FROM quizSessions
            WHERE sessionStatusId = %s
            ORDER BY session_date DESC, start_time DESC
        """
        params = [status_id]
        return Database.get_all_rows(sql, params)

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
    
class QuizSessionsRepository:
    # CREATE operations
    @staticmethod
    def create_quiz_session(session_date, name, description, sessionStatusId, themeId, 
                          hostUserId, start_time=None, end_time=None):
        sql = """
        INSERT INTO quizSessions 
        (session_date, name, description, sessionStatusId, themeId, hostUserId, start_time, end_time) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [session_date, name, description, sessionStatusId, themeId, 
                 hostUserId, start_time, end_time]
        return Database.execute_sql(sql, params)
    
    # READ operations
    @staticmethod
    def get_all_sessions(active_only=False):
        sql = "SELECT * FROM quizSessions"
        if active_only:
            sql += " WHERE sessionStatusId IN (SELECT id FROM sessionStatuses WHERE is_active = TRUE)"
        sql += " ORDER BY session_date DESC"
        return Database.get_rows(sql)
    
    @staticmethod
    def get_session_by_id(session_id):
        sql = """
        SELECT qs.*, 
               ss.name as status_name, 
               t.name as theme_name,
               u.username as host_username
        FROM quizSessions qs
        JOIN sessionStatuses ss ON qs.sessionStatusId = ss.id
        JOIN themes t ON qs.themeId = t.id
        JOIN users u ON qs.hostUserId = u.id
        WHERE qs.id = %s
        """
        params = [session_id]
        return Database.get_one_row(sql, params)
    
    @staticmethod
    def get_sessions_by_host(user_id):
        sql = "SELECT * FROM quizSessions WHERE hostUserId = %s ORDER BY session_date DESC"
        params = [user_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_active_sessions_by_theme(theme_id):
        sql = """
        SELECT qs.* 
        FROM quizSessions qs
        JOIN sessionStatuses ss ON qs.sessionStatusId = ss.id
        WHERE qs.themeId = %s AND ss.is_active = TRUE
        ORDER BY qs.session_date DESC
        """
        params = [theme_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_sessions_count_by_status(status_id):
        sql = "SELECT COUNT(*) as count FROM quizSessions WHERE sessionStatusId = %s"
        params = [status_id]
        result = Database.get_one_row(sql, params)
        return result['count'] if result else 0
    
    # UPDATE operations
    @staticmethod
    def update_session_status(session_id, new_status_id):
        sql = "UPDATE quizSessions SET sessionStatusId = %s WHERE id = %s"
        params = [new_status_id, session_id]
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_session_times(session_id, start_time=None, end_time=None):
        if start_time and end_time:
            sql = "UPDATE quizSessions SET start_time = %s, end_time = %s WHERE id = %s"
            params = [start_time, end_time, session_id]
        elif start_time:
            sql = "UPDATE quizSessions SET start_time = %s WHERE id = %s"
            params = [start_time, session_id]
        elif end_time:
            sql = "UPDATE quizSessions SET end_time = %s WHERE id = %s"
            params = [end_time, session_id]
        else:
            return False
        return Database.execute_sql(sql, params)
    
    @staticmethod
    def update_session_details(session_id, name=None, description=None, themeId=None):
        updates = []
        params = []
        
        if name:
            updates.append("name = %s")
            params.append(name)
        if description:
            updates.append("description = %s")
            params.append(description)
        if themeId:
            updates.append("themeId = %s")
            params.append(themeId)
            
        if not updates:
            return False
            
        sql = f"UPDATE quizSessions SET {', '.join(updates)} WHERE id = %s"
        params.append(session_id)
        return Database.execute_sql(sql, params)
    
    # DELETE operations (use with caution)
    @staticmethod
    def delete_session(session_id):
        sql = "DELETE FROM quizSessions WHERE id = %s"
        params = [session_id]
        return Database.execute_sql(sql, params)
    


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
    
    # READ operations
    @staticmethod
    def get_all_data_for_session(session_id):
        sql = "SELECT * FROM sensorData WHERE sessionId = %s ORDER BY timestamp ASC"
        params = [session_id]
        return Database.get_rows(sql, params)
    
    @staticmethod
    def get_all_data_for_session(session_id):
        sql = """
        SELECT * FROM sensorData 
        WHERE sessionId = %s 
        """
        params = [session_id]
        return Database.get_rows(sql, params)
    
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
    

