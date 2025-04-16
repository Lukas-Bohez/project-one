from database.database import Database
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from models import (
    # SQLAlchemy models
    User, Theme, Question, Answer, Item, QuizSession, SessionPlayer, SensorData, IPAddress, MediaFile,
    # Pydantic models
    UserCreate, ThemeCreate, QuestionCreate, ItemCreate, QuizSessionCreate, SessionPlayerCreate, 
    SensorDataCreate, IPAddressCreate, MediaFileCreate, AnswerBase, ThemeQuestionCount
)
from datetime import datetime, timezone

class DataRepository:
    """Repository class that handles all database operations"""
    
    @staticmethod
    def get_utc_now():
        """Get current UTC time with timezone information"""
        return datetime.now(timezone.utc)

    # User methods
    @staticmethod
    def create_user(db: Session, user: UserCreate) -> User:
        """Create a new user"""
        db_user = User(
            username=user.username,
            rfid_code=user.rfid_code,
            role=user.role
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def create_user_direct(user_data: Dict) -> Optional[int]:
        """Create a new user using direct database access"""
        db_user = User(
            username=user_data['username'],
            rfid_code=user_data['rfid_code'],
            role=user_data.get('role', 'User')
        )
        result = Database.execute_sql('insert', db_user)
        return result

    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        """Get a list of users with pagination"""
        return db.query(User).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_users_direct(skip: int = 0, limit: int = 100) -> List[User]:
        """Get a list of users using direct database access"""
        return Database.get_rows(User, filters=None, skip=skip, limit=limit)

    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        """Get a single user by ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_user_direct(user_id: int) -> Optional[User]:
        """Get a single user by ID using direct database access"""
        return Database.get_one_row(User, {'id': user_id})

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get a single user by username"""
        return db.query(User).filter(User.username == username).first()
    
    @staticmethod
    def get_user_by_username_direct(username: str) -> Optional[User]:
        """Get a single user by username using direct database access"""
        return Database.get_one_row(User, {'username': username})

    @staticmethod
    def get_user_by_rfid(db: Session, rfid_code: str) -> Optional[User]:
        """Get a single user by RFID code"""
        return db.query(User).filter(User.rfid_code == rfid_code).first()
    
    @staticmethod
    def get_user_by_rfid_direct(rfid_code: str) -> Optional[User]:
        """Get a single user by RFID code using direct database access"""
        return Database.get_one_row(User, {'rfid_code': rfid_code})

    @staticmethod
    def update_user(db: Session, user_id: int, user: UserCreate) -> Optional[User]:
        """Update an existing user"""
        db_user = db.query(User).filter(User.id == user_id).first()
        if db_user:
            db_user.username = user.username
            db_user.rfid_code = user.rfid_code
            db_user.role = user.role
            db_user.last_active = DataRepository.get_utc_now()
            db.commit()
            db.refresh(db_user)
        return db_user
    
    @staticmethod
    def update_user_direct(user_id: int, user_data: Dict) -> Optional[int]:
        """Update an existing user using direct database access"""
        db_user = Database.get_one_row(User, {'id': user_id})
        if db_user:
            db_user.username = user_data['username']
            db_user.rfid_code = user_data['rfid_code']
            db_user.role = user_data.get('role', db_user.role)
            db_user.last_active = DataRepository.get_utc_now()
            return Database.execute_sql('update', db_user)
        return None

    @staticmethod
    def delete_user(db: Session, user_id: int) -> Optional[User]:
        """Delete a user"""
        db_user = db.query(User).filter(User.id == user_id).first()
        if db_user:
            db.delete(db_user)
            db.commit()
        return db_user
    
    @staticmethod
    def delete_user_direct(user_id: int) -> Optional[int]:
        """Delete a user using direct database access"""
        db_user = Database.get_one_row(User, {'id': user_id})
        if db_user:
            return Database.execute_sql('delete', db_user)
        return None

    # Theme methods
    @staticmethod
    def create_theme(db: Session, theme: ThemeCreate, created_by: int) -> Theme:
        """Create a new theme"""
        db_theme = Theme(
            name=theme.name,
            created_by=created_by
        )
        db.add(db_theme)
        db.commit()
        db.refresh(db_theme)
        return db_theme
    
    @staticmethod
    def create_theme_direct(theme_data: Dict) -> Optional[int]:
        """Create a new theme using direct database access"""
        db_theme = Theme(
            name=theme_data['name'],
            created_by=theme_data['created_by']
        )
        return Database.execute_sql('insert', db_theme)

    @staticmethod
    def get_themes(db: Session, skip: int = 0, limit: int = 100) -> List[Theme]:
        """Get a list of themes with pagination"""
        return db.query(Theme).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_themes_direct(skip: int = 0, limit: int = 100) -> List[Theme]:
        """Get a list of themes using direct database access"""
        return Database.get_rows(Theme, filters=None, skip=skip, limit=limit)

    @staticmethod
    def get_theme(db: Session, theme_id: int) -> Optional[Theme]:
        """Get a single theme by ID"""
        return db.query(Theme).filter(Theme.id == theme_id).first()
    
    @staticmethod
    def get_theme_direct(theme_id: int) -> Optional[Theme]:
        """Get a single theme by ID using direct database access"""
        return Database.get_one_row(Theme, {'id': theme_id})

    # Question methods
    @staticmethod
    def create_question(db: Session, question: QuestionCreate, created_by: int) -> Question:
        """Create a new question with optional answers"""
        db_question = Question(
            text=question.text,
            theme_id=question.theme_id,
            difficulty=question.difficulty,
            explanation=question.explanation,
            created_by=created_by
        )
        db.add(db_question)
        db.commit()
        db.refresh(db_question)

        # Add answers if provided
        for answer_data in question.answers:
            db_answer = Answer(
                question_id=db_question.id,
                text=answer_data.text,
                is_correct=answer_data.is_correct
            )
            db.add(db_answer)
        
        db.commit()
        db.refresh(db_question)
        return db_question

    @staticmethod
    def get_questions(
        db: Session, 
        skip: int = 0, 
        limit: int = 100, 
        theme_id: Optional[int] = None,
        difficulty: Optional[str] = None
    ) -> List[Question]:
        """Get a list of questions with optional filters"""
        query = db.query(Question)
        
        if theme_id:
            query = query.filter(Question.theme_id == theme_id)
        
        if difficulty:
            query = query.filter(Question.difficulty == difficulty)
            
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def get_questions_direct(
        skip: int = 0, 
        limit: int = 100, 
        theme_id: Optional[int] = None,
        difficulty: Optional[str] = None
    ) -> List[Question]:
        """Get a list of questions using direct database access"""
        filters = {}
        if theme_id:
            filters['theme_id'] = theme_id
        
        if difficulty:
            filters['difficulty'] = difficulty
            
        return Database.get_rows(Question, filters=filters if filters else None, skip=skip, limit=limit)

    @staticmethod
    def get_question(db: Session, question_id: int) -> Optional[Question]:
        """Get a single question by ID"""
        return db.query(Question).filter(Question.id == question_id).first()
    
    @staticmethod
    def get_question_direct(question_id: int) -> Optional[Question]:
        """Get a single question by ID using direct database access"""
        return Database.get_one_row(Question, {'id': question_id})

    # Quiz Session methods
    @staticmethod
    def create_quiz_session(db: Session, session_data: QuizSessionCreate, created_by: int) -> QuizSession:
        """Create a new quiz session"""
        db_session = QuizSession(
            name=session_data.name,
            created_by=created_by
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session
    
    @staticmethod
    def create_quiz_session_direct(session_data: Dict) -> Optional[int]:
        """Create a new quiz session using direct database access"""
        db_session = QuizSession(
            name=session_data['name'],
            created_by=session_data['created_by']
        )
        return Database.execute_sql('insert', db_session)

    @staticmethod
    def get_quiz_sessions(db: Session, skip: int = 0, limit: int = 100) -> List[QuizSession]:
        """Get a list of quiz sessions"""
        return db.query(QuizSession).order_by(desc(QuizSession.start_time)).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_quiz_sessions_direct(skip: int = 0, limit: int = 100) -> List[QuizSession]:
        """Get a list of quiz sessions using direct database access"""
        return Database.get_rows(QuizSession, skip=skip, limit=limit)

    @staticmethod
    def get_quiz_session(db: Session, session_id: int) -> Optional[QuizSession]:
        """Get a single quiz session by ID"""
        return db.query(QuizSession).filter(QuizSession.id == session_id).first()
    
    @staticmethod
    def get_quiz_session_direct(session_id: int) -> Optional[QuizSession]:
        """Get a single quiz session by ID using direct database access"""
        return Database.get_one_row(QuizSession, {'id': session_id})

    # Session Player methods
    @staticmethod
    def add_player_to_session(db: Session, session_id: int, user_id: int) -> SessionPlayer:
        """Add a player to a quiz session"""
        db_player = SessionPlayer(
            session_id=session_id,
            user_id=user_id
        )
        db.add(db_player)
        db.commit()
        db.refresh(db_player)
        return db_player
    
    @staticmethod
    def add_player_to_session_direct(session_id: int, user_id: int) -> Optional[int]:
        """Add a player to a quiz session using direct database access"""
        db_player = SessionPlayer(
            session_id=session_id,
            user_id=user_id
        )
        return Database.execute_sql('insert', db_player)

    @staticmethod
    def update_player_score(db: Session, session_id: int, user_id: int, score: int) -> Optional[SessionPlayer]:
        """Update a player's score in a quiz session"""
        db_player = db.query(SessionPlayer).filter(
            SessionPlayer.session_id == session_id, 
            SessionPlayer.user_id == user_id
        ).first()
        
        if db_player:
            db_player.score = score
            db.commit()
            db.refresh(db_player)
        
        return db_player
    
    @staticmethod
    def update_player_score_direct(session_id: int, user_id: int, score: int) -> Optional[int]:
        """Update a player's score using direct database access"""
        db_player = Database.get_one_row(SessionPlayer, {'session_id': session_id, 'user_id': user_id})
        if db_player:
            db_player.score = score
            return Database.execute_sql('update', db_player)
        return None

    # Utility methods
    @staticmethod
    def get_theme_question_counts(db: Session) -> List[Dict]:
        """Get the count of questions for each theme"""
        results = db.query(
            Theme.id.label('theme_id'),
            Theme.name.label('theme_name'),
            func.count(Question.id).label('question_count')
        ).outerjoin(Question).group_by(Theme.id, Theme.name).all()
        
        return [
            {
                'theme_id': result.theme_id,
                'theme_name': result.theme_name,
                'question_count': result.question_count
            }
            for result in results
        ]
    
    @staticmethod
    def get_user_progress(db: Session, user_id: int) -> Dict:
        """Get user progress data - example implementation"""
        # This is a simplified example - implement actual logic as needed
        question_count = db.query(func.count(Question.id)).filter(
            Question.created_by == user_id
        ).scalar() or 0
        
        # Example daily goal - this should be customized based on your requirements
        daily_goal = 10
        
        return {
            "current": question_count,
            "goal": daily_goal
        }