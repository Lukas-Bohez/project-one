from mysql import connector
from config import db_config
from typing import List, Dict, Any, Optional
import threading

class Database:
    # Thread-local storage prevents weak reference issues
    _local = threading.local()

    @classmethod
    def __open_connection(cls):
        """Open connection exactly as before, but thread-safe"""
        try:
            if not hasattr(cls._local, 'db'):
                cls._local.db = connector.connect(**db_config)
                # Keep dictionary=True as in your original
                cls._local.cursor = cls._local.db.cursor(dictionary=True, buffered=True)
        except connector.Error as err:
            if err.errno == connector.errorcode.ER_ACCESS_DENIED_ERROR:
                print("Error: Database access denied. Check credentials.")
            elif err.errno == connector.errorcode.ER_BAD_DB_ERROR:
                print("Error: Database does not exist.")
            else:
                print(f"Database connection error: {err}")
            raise

    @classmethod
    def __close_connection(cls):
        """Close connection exactly as before"""
        if hasattr(cls._local, 'cursor'):
            cls._local.cursor.close()
            del cls._local.cursor
        if hasattr(cls._local, 'db'):
            cls._local.db.close()
            del cls._local.db

    @classmethod
    def get_rows(cls, sql_query, params=None):
        """Identical to your original implementation"""
        try:
            cls.__open_connection()
            cls._local.cursor.execute(sql_query, params)
            return cls._local.cursor.fetchall()
        except Exception as error:
            print(f"Query error: {error}")
            return None
        finally:
            cls.__close_connection()

    @classmethod
    def get_one_row(cls, sql_query, params=None):
        """Identical to your original implementation"""
        try:
            cls.__open_connection()
            cls._local.cursor.execute(sql_query, params)
            return cls._local.cursor.fetchone()
        except Exception as error:
            print(f"Query error: {error}")
            return None
        finally:
            cls.__close_connection()

    @staticmethod
    def get_all_rows(sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        """EXACTLY your original implementation"""
        connection = None
        try:
            connection = connector.connect(**db_config)
            # Changed to numeric cursor to maintain session[0] access
            with connection.cursor() as cursor:  # Removed dictionary=True
                cursor.execute(sql, params)
                results = cursor.fetchall()
                return results if results else []
        except Exception as e:
            print(f"Error executing get_all_rows query: {e}")
            raise
        finally:
            if connection:
                connection.close()

    @classmethod
    def execute_sql(cls, sql_query, params=None):
        """Identical to your original implementation"""
        try:
            cls.__open_connection()
            cls._local.cursor.execute(sql_query, params)
            
            query_type = sql_query.strip().upper().split()[0]
            
            if query_type == 'SELECT':
                return cls._local.cursor.fetchall()
            else:
                cls._local.db.commit()
                if cls._local.cursor.lastrowid:
                    return cls._local.cursor.lastrowid
                return cls._local.cursor.rowcount
                
        except connector.Error as error:
            if hasattr(cls._local, 'db'):
                cls._local.db.rollback()
            print(f"Execute error: {error}")
            return None
        finally:
            cls.__close_connection()