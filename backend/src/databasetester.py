import mysql.connector
import config

try:
    # Connect to the database
    connection = mysql.connector.connect(**config.db_config)
    cursor = connection.cursor()
    
    # Define the tables to query
    tables = ["questions", "themes", "answers", "users"]
    
    for table in tables:
        print(f"\n--- First 50 rows from {table} table ---")
        query = f"SELECT * FROM {table} ORDER BY id LIMIT 50"
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Print column headers (optional, if needed)
        cursor.execute(f"SHOW COLUMNS FROM {table}")
        columns = [column[0] for column in cursor.fetchall()]
        print("Columns:", ", ".join(columns))
        
        # Print rows
        for row in rows:
            print(row)
    
except mysql.connector.Error as e:
    print(f"Error querying database: {e}")
finally:
    if 'cursor' in locals() and cursor:
        cursor.close()
    if 'connection' in locals() and connection:
        connection.close()