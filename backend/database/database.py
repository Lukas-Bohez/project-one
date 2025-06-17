from mysql import connector
from config import db_config
from typing import List, Dict, Any, Optional, Union

class Database:
    db = None
    cursor = None
    
    @staticmethod
    def get_connection():
        """Creates and returns a new database connection."""
        try:
            return connector.connect(**db_config)
        except connector.Error as err:
            print(f"Database connection error: {err}")
            raise

    @classmethod
    def __open_connection(cls):
        try:
            cls.db = connector.connect(**db_config)
            cls.cursor = cls.db.cursor(buffered=True)
        except connector.Error as err:
            print(f"Database connection error: {err}")
            raise

    @classmethod
    def __close_connection(cls):
        try:
            if cls.cursor:
                cls.cursor.close()
            if cls.db:
                cls.db.close()
        except:
            pass

    @classmethod
    def _make_result(cls, rows):
        """Convert raw rows to mutable dictionaries that support both access patterns"""
        if not rows:
            return []
        
        column_names = [col[0] for col in cls.cursor.description]
        return [MutableRow(row, column_names) for row in rows]

    @classmethod
    def get_rows(cls, sql_query, params=None) -> List[Dict]:
        try:
            cls.__open_connection()
            cls.cursor.execute(sql_query, params or ())
            return cls._make_result(cls.cursor.fetchall())
        except Exception as error:
            print(f"Query error: {error}")
            return []
        finally:
            cls.__close_connection()

    @classmethod
    def get_one_row(cls, sql_query, params=None) -> Optional[Dict]:
        try:
            cls.__open_connection()
            cls.cursor.execute(sql_query, params or ())
            row = cls.cursor.fetchone()
            if row:
                return MutableRow(row, [col[0] for col in cls.cursor.description])
            return None
        except Exception as error:
            print(f"Query error: {error}")
            return None
        finally:
            cls.__close_connection()

    @staticmethod
    def get_all_rows(sql: str, params: Optional[List[Any]] = None) -> List[Dict]:
        connection = None
        cursor = None
        try:
            connection = Database.get_connection()
            cursor = connection.cursor(buffered=True)
            cursor.execute(sql, params or ())
            
            column_names = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            return [MutableRow(row, column_names) for row in rows] if rows else []
        except Exception as e:
            print(f"Error executing get_all_rows query: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    @classmethod
    def execute_sql(cls, sql_query, params=None):
        try:
            cls.__open_connection()
            cls.cursor.execute(sql_query, params or ())
            
            query_type = sql_query.strip().upper().split()[0]
            
            if query_type == 'SELECT':
                return cls._make_result(cls.cursor.fetchall())
            else:
                cls.db.commit()
                if cls.cursor.lastrowid:
                    return cls.cursor.lastrowid
                return cls.cursor.rowcount
                
        except connector.Error as error:
            if cls.db:
                cls.db.rollback()
            print(f"Execute error: {error}")
            return None
        finally:
            cls.__close_connection()

class MutableRow(dict):
    """A row that supports both dictionary and tuple-like access and is mutable"""
    def __init__(self, data, columns):
        super().__init__(zip(columns, data))
        self._columns = columns
        self._data = tuple(data)
        
    def __getitem__(self, key):
        if isinstance(key, int):
            return self._data[key]
        return super().__getitem__(key)
        
    def __setitem__(self, key, value):
        if isinstance(key, int):
            # Convert to list, modify, then convert back to tuple
            temp = list(self._data)
            temp[key] = value
            self._data = tuple(temp)
            # Also update the dict version
            super().__setitem__(self._columns[key], value)
        else:
            super().__setitem__(key, value)
            # Update tuple version if key exists
            if key in self._columns:
                index = self._columns.index(key)
                temp = list(self._data)
                temp[index] = value
                self._data = tuple(temp)
    
    def __iter__(self):
        return iter(self._data)
        
    def __len__(self):
        return len(self._data)
    
    def get(self, key, default=None):
        try:
            return self[key]
        except (KeyError, IndexError):
            return default