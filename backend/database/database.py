from mysql import connector
import os
from config import db_config
from typing import List, Dict, Any, Optional

class Database:
    # Remove static variables - they cause connection issues
    db = None
    cursor = None
    @staticmethod
    def get_connection():
        """Creates and returns a new database connection."""
        try:
            return connector.connect(**db_config)
        except connector.Error as err:
            if err.errno == connector.errorcode.ER_ACCESS_DENIED_ERROR:
                print("Error: Database access denied. Check credentials.")
            elif err.errno == connector.errorcode.ER_BAD_DB_ERROR:
                print("Error: Database does not exist.")
            else:
                print(f"Database connection error: {err}")
            raise # Re-raise the exception


    @classmethod
    def __open_connection(cls):
        try:
            cls.db = connector.connect(**db_config)
            cls.cursor = cls.db.cursor(dictionary=True, buffered=True)
        except connector.Error as err:
            if err.errno == connector.errorcode.ER_ACCESS_DENIED_ERROR:
                print("Error: Database access denied. Check credentials.")
            elif err.errno == connector.errorcode.ER_BAD_DB_ERROR:
                print("Error: Database does not exist.")
            else:
                print(f"Database connection error: {err}")
            raise  # Re-raise the exception

    @classmethod
    def __close_connection(cls):
        if cls.cursor:
            cls.cursor.close()
        if cls.db:
            cls.db.close()

    @classmethod
    def get_rows(cls, sql_query, params=None):
        try:
            cls.__open_connection()
            cls.cursor.execute(sql_query, params)
            return cls.cursor.fetchall()
        except Exception as error:
            print(f"Query error: {error}")
            return None
        finally:
            cls.__close_connection()

    @classmethod
    def get_one_row(cls, sql_query, params=None):
        try:
            cls.__open_connection()
            cls.cursor.execute(sql_query, params)
            return cls.cursor.fetchone()
        except Exception as error:
            print(f"Query error: {error}")
            return None
        finally:
            cls.__close_connection()

    @staticmethod
    def get_all_rows(sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        """Executes a SELECT query and returns all matching rows as a list of dictionaries."""
        connection = None
        try:
            connection = Database.get_connection()
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                results = cursor.fetchall() # Use fetchall() for multiple rows
                return results if results else []
        except Exception as e:
            print(f"Error executing get_all_rows query: {e}")
            raise
        finally:
            if connection:
                connection.close()

    @classmethod
    def execute_sql(cls, sql_query, params=None):
        try:
            cls.__open_connection()
            cls.cursor.execute(sql_query, params)
            
            # Check if it's a SELECT query
            query_type = sql_query.strip().upper().split()[0]
            
            if query_type == 'SELECT':
                # For SELECT queries, return the actual results
                return cls.cursor.fetchall()
            else:
                # For INSERT/UPDATE/DELETE queries, commit and return appropriate info
                cls.db.commit()
                
                if cls.cursor.lastrowid:  # For INSERT
                    return cls.cursor.lastrowid
                return cls.cursor.rowcount  # For UPDATE/DELETE
                
        except connector.Error as error:
            if cls.db:
                cls.db.rollback()
            print(f"Execute error: {error}")
            return None
        finally:
            cls.__close_connection()