"""
Manage the Spire Data Repository
Handles all database operations for the employee management system
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from config.config import db_config
from mysql.connector import Error, pooling

logger = logging.getLogger("manage_the_spire")

# Use the existing connection pool from Quiz the Spire
connection_pool = pooling.MySQLConnectionPool(**db_config)


class ManageBusinessRepository:
    """Repository for business/company management"""

    @staticmethod
    def create_business(business_data: Dict[str, Any]) -> Optional[int]:
        """Create a new business"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = """
                INSERT INTO manage_businesses 
                (business_name, owner_user_id, contact_email, contact_phone, 
                 address, timezone, subscription_tier, max_employees, settings_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                query,
                (
                    business_data.get("business_name"),
                    business_data.get("owner_user_id"),
                    business_data.get("contact_email"),
                    business_data.get("contact_phone"),
                    business_data.get("address"),
                    business_data.get("timezone", "UTC"),
                    business_data.get("subscription_tier", "free"),
                    business_data.get("max_employees", 10),
                    business_data.get("settings_json"),
                ),
            )

            conn.commit()
            business_id = cursor.lastrowid
            cursor.close()
            conn.close()

            return business_id
        except Error as e:
            logger.error(f"Error creating business: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_business_by_id(business_id: int) -> Optional[Dict[str, Any]]:
        """Get business by ID"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = "SELECT * FROM manage_businesses WHERE id = %s"
            cursor.execute(query, (business_id,))
            result = cursor.fetchone()

            cursor.close()
            conn.close()
            return result
        except Error as e:
            logger.error(f"Error fetching business: {e}")
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_businesses_by_owner(owner_user_id: int) -> List[Dict[str, Any]]:
        """Get all businesses owned by a user"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = "SELECT * FROM manage_businesses WHERE owner_user_id = %s AND is_active = TRUE"
            cursor.execute(query, (owner_user_id,))
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching businesses by owner: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


class ManageEmployeeRepository:
    """Repository for employee management"""

    @staticmethod
    def get_employee_roles() -> List[Dict[str, Any]]:
        """Get available employee roles"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = "SELECT id, role_name FROM manage_employee_roles ORDER BY id"
            cursor.execute(query)
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching employee roles: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create_employee(employee_data: Dict[str, Any]) -> Optional[int]:
        """Create a new employee"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = """
                INSERT INTO manage_employees 
                (business_id, user_id, employee_code, email, first_name, last_name, 
                 phone, role_id, position_title, department, hire_date, hourly_rate, 
                 emergency_contact_name, emergency_contact_phone, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                query,
                (
                    employee_data.get("business_id"),
                    employee_data.get("user_id"),
                    employee_data.get("employee_code"),
                    employee_data.get("email"),
                    employee_data.get("first_name"),
                    employee_data.get("last_name"),
                    employee_data.get("phone"),
                    employee_data.get("role_id", 3),  # Default to 'employee' role
                    employee_data.get("position_title"),
                    employee_data.get("department"),
                    employee_data.get("hire_date"),
                    employee_data.get("hourly_rate"),
                    employee_data.get("emergency_contact_name"),
                    employee_data.get("emergency_contact_phone"),
                    employee_data.get("status", "active"),
                ),
            )

            conn.commit()
            employee_id = cursor.lastrowid
            cursor.close()
            conn.close()

            return employee_id
        except Error as e:
            logger.error(f"Error creating employee: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_employees_by_business(
        business_id: int, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all employees for a business"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            if status:
                query = """
                    SELECT e.*, r.role_name 
                    FROM manage_employees e
                    JOIN manage_employee_roles r ON e.role_id = r.id
                    WHERE e.business_id = %s AND e.status = %s
                    ORDER BY e.last_name, e.first_name
                """
                cursor.execute(query, (business_id, status))
            else:
                query = """
                    SELECT e.*, r.role_name 
                    FROM manage_employees e
                    JOIN manage_employee_roles r ON e.role_id = r.id
                    WHERE e.business_id = %s
                    ORDER BY e.last_name, e.first_name
                """
                cursor.execute(query, (business_id,))

            results = cursor.fetchall()
            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching employees: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_employee_by_id(employee_id: int) -> Optional[Dict[str, Any]]:
        """Get employee by ID"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT e.*, r.role_name 
                FROM manage_employees e
                JOIN manage_employee_roles r ON e.role_id = r.id
                WHERE e.id = %s
            """
            cursor.execute(query, (employee_id,))
            result = cursor.fetchone()

            cursor.close()
            conn.close()
            return result
        except Error as e:
            logger.error(f"Error fetching employee: {e}")
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update_employee(employee_id: int, update_data: Dict[str, Any]) -> bool:
        """Update an employee record"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            allowed_fields = {
                "user_id",
                "employee_code",
                "email",
                "first_name",
                "last_name",
                "phone",
                "role_id",
                "position_title",
                "department",
                "hire_date",
                "termination_date",
                "hourly_rate",
                "status",
                "emergency_contact_name",
                "emergency_contact_phone",
            }

            set_clauses = []
            params = []

            for field, value in update_data.items():
                if field in allowed_fields:
                    set_clauses.append(f"{field} = %s")
                    params.append(value)

            if not set_clauses:
                return False

            params.append(employee_id)
            query = (
                f"UPDATE manage_employees SET {', '.join(set_clauses)} WHERE id = %s"
            )
            cursor.execute(query, params)
            conn.commit()

            return cursor.rowcount > 0
        except Error as e:
            logger.error(f"Error updating employee: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def delete_employee(employee_id: int) -> bool:
        """Delete an employee record"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = "DELETE FROM manage_employees WHERE id = %s"
            cursor.execute(query, (employee_id,))
            conn.commit()

            return cursor.rowcount > 0
        except Error as e:
            logger.error(f"Error deleting employee: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


class ManageShiftRepository:
    """Repository for shift scheduling"""

    @staticmethod
    def create_shift(shift_data: Dict[str, Any]) -> Optional[int]:
        """Create a new shift"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = """
                INSERT INTO manage_shifts 
                (business_id, employee_id, shift_date, start_time, end_time, 
                 position, location, break_minutes, notes, status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                query,
                (
                    shift_data.get("business_id"),
                    shift_data.get("employee_id"),
                    shift_data.get("shift_date"),
                    shift_data.get("start_time"),
                    shift_data.get("end_time"),
                    shift_data.get("position"),
                    shift_data.get("location"),
                    shift_data.get("break_minutes", 0),
                    shift_data.get("notes"),
                    shift_data.get("status", "scheduled"),
                    shift_data.get("created_by"),
                ),
            )

            conn.commit()
            shift_id = cursor.lastrowid
            cursor.close()
            conn.close()

            return shift_id
        except Error as e:
            logger.error(f"Error creating shift: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_shifts_by_date_range(
        business_id: int, start_date: date, end_date: date
    ) -> List[Dict[str, Any]]:
        """Get shifts within a date range"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT s.*, e.first_name, e.last_name, e.employee_code
                FROM manage_shifts s
                JOIN manage_employees e ON s.employee_id = e.id
                WHERE s.business_id = %s 
                  AND s.shift_date BETWEEN %s AND %s
                ORDER BY s.shift_date, s.start_time
            """
            cursor.execute(query, (business_id, start_date, end_date))
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching shifts: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_employee_shifts(
        employee_id: int, start_date: date, end_date: date
    ) -> List[Dict[str, Any]]:
        """Get shifts for a specific employee"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT * FROM manage_shifts
                WHERE employee_id = %s 
                  AND shift_date BETWEEN %s AND %s
                  AND status != 'cancelled'
                ORDER BY shift_date, start_time
            """
            cursor.execute(query, (employee_id, start_date, end_date))
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching employee shifts: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


class ManageTimeOffRepository:
    """Repository for time-off requests"""

    @staticmethod
    def create_time_off_request(request_data: Dict[str, Any]) -> Optional[int]:
        """Create a new time-off request"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = """
                INSERT INTO manage_time_off_requests 
                (business_id, employee_id, request_type, start_date, end_date, 
                 total_hours, reason, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                query,
                (
                    request_data.get("business_id"),
                    request_data.get("employee_id"),
                    request_data.get("request_type"),
                    request_data.get("start_date"),
                    request_data.get("end_date"),
                    request_data.get("total_hours"),
                    request_data.get("reason"),
                    request_data.get("status", "pending"),
                ),
            )

            conn.commit()
            request_id = cursor.lastrowid
            cursor.close()
            conn.close()

            return request_id
        except Error as e:
            logger.error(f"Error creating time-off request: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_pending_requests(business_id: int) -> List[Dict[str, Any]]:
        """Get all pending time-off requests for a business"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT r.*, e.first_name, e.last_name, e.employee_code
                FROM manage_time_off_requests r
                JOIN manage_employees e ON r.employee_id = e.id
                WHERE r.business_id = %s AND r.status = 'pending'
                ORDER BY r.created_at
            """
            cursor.execute(query, (business_id,))
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching pending requests: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


class ManageWarningRepository:
    """Repository for warnings and disciplinary actions"""

    @staticmethod
    def create_warning(warning_data: Dict[str, Any]) -> Optional[int]:
        """Create a new warning"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = """
                INSERT INTO manage_warnings 
                (business_id, employee_id, warning_type, category, incident_date, 
                 description, corrective_action, follow_up_date, issued_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            cursor.execute(
                query,
                (
                    warning_data.get("business_id"),
                    warning_data.get("employee_id"),
                    warning_data.get("warning_type"),
                    warning_data.get("category"),
                    warning_data.get("incident_date"),
                    warning_data.get("description"),
                    warning_data.get("corrective_action"),
                    warning_data.get("follow_up_date"),
                    warning_data.get("issued_by"),
                ),
            )

            conn.commit()
            warning_id = cursor.lastrowid
            cursor.close()
            conn.close()

            return warning_id
        except Error as e:
            logger.error(f"Error creating warning: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_employee_warnings(
        employee_id: int, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Get warnings for an employee"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            if active_only:
                query = """
                    SELECT * FROM manage_warnings
                    WHERE employee_id = %s AND is_active = TRUE
                    ORDER BY incident_date DESC
                """
            else:
                query = """
                    SELECT * FROM manage_warnings
                    WHERE employee_id = %s
                    ORDER BY incident_date DESC
                """

            cursor.execute(query, (employee_id,))
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching warnings: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


class ManageShiftRepository:
    """Repository for shift management"""

    @staticmethod
    def get_shift_by_id(shift_id: int) -> Optional[Dict[str, Any]]:
        """Get shift by ID"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = "SELECT * FROM manage_shifts WHERE id = %s"
            cursor.execute(query, (shift_id,))
            result = cursor.fetchone()

            cursor.close()
            conn.close()
            return result
        except Error as e:
            logger.error(f"Error fetching shift: {e}")
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update_shift(shift_id: int, shift_data: Dict[str, Any]) -> bool:
        """Update a shift"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            # Build dynamic UPDATE query with allowlist to prevent SQL injection
            allowed_fields = {
                "employee_id",
                "shift_date",
                "start_time",
                "end_time",
                "break_duration",
                "status",
                "notes",
                "shift_type",
                "location",
                "department",
            }
            fields = []
            values = []
            for key, value in shift_data.items():
                if key != "id" and key in allowed_fields:
                    fields.append(f"{key} = %s")
                    values.append(value)

            if not fields:
                return True

            values.append(shift_id)
            query = f"UPDATE manage_shifts SET {', '.join(fields)} WHERE id = %s"

            cursor.execute(query, values)
            conn.commit()

            cursor.close()
            conn.close()
            return cursor.rowcount > 0
        except Error as e:
            logger.error(f"Error updating shift: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def delete_shift(shift_id: int) -> bool:
        """Delete a shift"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = "DELETE FROM manage_shifts WHERE id = %s"
            cursor.execute(query, (shift_id,))
            conn.commit()

            cursor.close()
            conn.close()
            return cursor.rowcount > 0
        except Error as e:
            logger.error(f"Error deleting shift: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


class ManageTimeOffRepository:
    """Repository for time-off request management"""

    @staticmethod
    def get_time_off_request_by_id(request_id: int) -> Optional[Dict[str, Any]]:
        """Get time-off request by ID"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = "SELECT * FROM manage_time_off WHERE id = %s"
            cursor.execute(query, (request_id,))
            result = cursor.fetchone()

            cursor.close()
            conn.close()
            return result
        except Error as e:
            logger.error(f"Error fetching time-off request: {e}")
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_employee_time_off_requests(employee_id: int) -> List[Dict[str, Any]]:
        """Get all time-off requests for an employee"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT * FROM manage_time_off
                WHERE employee_id = %s
                ORDER BY start_date DESC
            """
            cursor.execute(query, (employee_id,))
            results = cursor.fetchall()

            cursor.close()
            conn.close()
            return results
        except Error as e:
            logger.error(f"Error fetching employee time-off requests: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def review_time_off_request(request_id: int, review_data: Dict[str, Any]) -> bool:
        """Review (approve/deny) a time-off request"""
        conn = None
        cursor = None
        try:
            conn = connection_pool.get_connection()
            cursor = conn.cursor()

            query = """
                UPDATE manage_time_off
                SET status = %s, reviewed_by_user_id = %s, reviewed_date = NOW(),
                    review_notes = %s
                WHERE id = %s
            """

            cursor.execute(
                query,
                (
                    review_data.get("status"),
                    review_data.get("reviewed_by_user_id"),
                    review_data.get("review_notes"),
                    request_id,
                ),
            )

            conn.commit()
            cursor.close()
            conn.close()
            return cursor.rowcount > 0
        except Error as e:
            logger.error(f"Error reviewing time-off request: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
