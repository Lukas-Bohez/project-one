from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import SQLAlchemyError
from config import settings
import os

# No need to import or register PyMySQL
# We'll use mysql-connector-python instead

Base = declarative_base()

class Database:
    # Class variables for connection reuse
    engine = None
    SessionLocal = None
   
    @staticmethod
    def __init_connection():
        """Initialize database connection"""
        try:
            if Database.engine is None:
                # MySQL connection URL format with mysql-connector-python:
                # mysql+mysqlconnector://username:password@host:port/database
                Database.engine = create_engine(
                    settings.DATABASE_URL,
                    pool_pre_ping=True,
                    pool_recycle=3600,  # Prevent connection timeouts
                    pool_size=10,       # Connection pool size
                    max_overflow=20,    # Max extra connections when pool is full
                    echo=settings.DB_ECHO if hasattr(settings, 'DB_ECHO') else False
                )
               
            if Database.SessionLocal is None:
                Database.SessionLocal = sessionmaker(
                    autocommit=False,
                    autoflush=False,
                    bind=Database.engine
                )
           
            return True
        except SQLAlchemyError as err:
            print(f"Database connection error: {err}")
            return False
   
    @staticmethod
    def get_db():
        """Get database session - use this for dependency injection in FastAPI"""
        Database.__init_connection()
        db = Database.SessionLocal()
        try:
            yield db
        finally:
            db.close()
   
    @staticmethod
    def create_tables():
        """Create all tables defined in models"""
        Database.__init_connection()
        Base.metadata.create_all(bind=Database.engine)
   
    @staticmethod
    def get_rows(model_class, filters=None, skip=0, limit=100):
        """Execute a read query and return multiple rows"""
        Database.__init_connection()
        db = Database.SessionLocal()
        result = None
        try:
            query = db.query(model_class)
           
            if filters:
                query = query.filter_by(**filters)
               
            result = query.offset(skip).limit(limit).all()
        except SQLAlchemyError as error:
            print(f"Error getting rows: {error}")
            result = None
        finally:
            db.close()
            return result
   
    @staticmethod
    def get_one_row(model_class, filters):
        """Execute a read query and return a single row"""
        Database.__init_connection()
        db = Database.SessionLocal()
        result = None
        try:
            result = db.query(model_class).filter_by(**filters).first()
        except SQLAlchemyError as error:
            print(f"Error getting row: {error}")
            result = None
        finally:
            db.close()
            return result
   
    @staticmethod
    def execute_sql(operation_type, model_instance):
        """Execute INSERT, UPDATE, or DELETE operations"""
        Database.__init_connection()
        db = Database.SessionLocal()
        result = None
        try:
            if operation_type.lower() == 'insert':
                db.add(model_instance)
                db.commit()
                db.refresh(model_instance)
                result = model_instance.id  # Return the ID of the new record
           
            elif operation_type.lower() == 'update':
                db.commit()
                db.refresh(model_instance)
                result = 1  # Indicate success
           
            elif operation_type.lower() == 'delete':
                db.delete(model_instance)
                db.commit()
                result = 1  # Indicate success
               
        except SQLAlchemyError as error:
            db.rollback()
            print(f"Error executing SQL: {error}")
            result = None
        finally:
            db.close()
            return result

# Keep the original get_db function for backward compatibility
def get_db():
    """Original get_db function maintained for backward compatibility"""
    return Database.get_db()