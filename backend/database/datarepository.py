from .database import Database

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