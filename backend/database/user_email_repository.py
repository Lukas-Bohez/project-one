from .database import Database
from typing import Dict, Any, Optional


class UserEmailRepository:
    """Small, focused repository used only for safely creating users when an
    explicit email column should be filled. This keeps changes isolated from
    the main `datarepository.py` implementation.
    """

    @staticmethod
    def create_user_with_email(user_data: Dict[str, Any]) -> Optional[int]:
        """Insert a user row that includes the `email` column. Returns the
        new user id on success or None on failure.
        Expected keys in user_data: last_name, first_name, email, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, updated_by
        """
        sql = """
            INSERT INTO users (last_name, first_name, email, password_hash, salt, rfid_code, userRoleId, soul_points, limb_points, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        params = [
            user_data.get('last_name'),
            user_data.get('first_name'),
            user_data.get('email'),
            user_data.get('password_hash'),
            user_data.get('salt'),
            user_data.get('rfid_code'),
            user_data.get('userRoleId', 1),
            user_data.get('soul_points', 4),
            user_data.get('limb_points', 4),
            user_data.get('updated_by', 1)
        ]

        return Database.execute_sql(sql, params)

    @staticmethod
    def update_user_profile(user_id: int, profile_data: Dict[str, Any]) -> bool:
        """Update user profile fields that include the email column."""
        set_clauses = []
        params = []

        if 'email' in profile_data and profile_data['email'] is not None:
            set_clauses.append("email = %s")
            params.append(profile_data['email'])
        if 'first_name' in profile_data and profile_data['first_name'] is not None:
            set_clauses.append("first_name = %s")
            params.append(profile_data['first_name'])
        if 'last_name' in profile_data and profile_data['last_name'] is not None:
            set_clauses.append("last_name = %s")
            params.append(profile_data['last_name'])

        if not set_clauses:
            return False

        params.append(user_id)
        sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s"
        return bool(Database.execute_sql(sql, params))
