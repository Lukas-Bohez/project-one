import re

import config
import mysql.connector


def identify_suspicious_users():
    """Identify users that match suspicious patterns"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print("🔍 Scanning for suspicious user accounts...")
        print("=" * 80)

        # Get all users
        cursor.execute("""
            SELECT id, first_name, last_name, rfid_code, last_active
            FROM users 
            ORDER BY id
        """)

        users = cursor.fetchall()

        suspicious_users = []

        # Define suspicious patterns
        suspicious_patterns = [
            r".*[dicken].*",  # Contains "dicken" (case insensitive)
            r".*[sider].*",  # Contains "sider" (case insensitive)
            r".*[/@\.#\$%\^&\*\(\)\[\]\{\}\\|<>].*",  # Contains special symbols
            r".*\d{3,}.*",  # Contains 3 or more consecutive numbers
            r"^.{1,2}$",  # Very short names (1-2 characters)
            r".*[aeiou]{4,}.*",  # 4+ consecutive vowels (spam pattern)
            r".*(.)\1{3,}.*",  # Same character repeated 4+ times
        ]

        for user_id, first_name, last_name, rfid_code, last_active in users:
            is_suspicious = False
            reasons = []

            # Check first name
            if first_name:
                first_lower = first_name.lower()

                # Check for "dicken" or "sider"
                if "dicken" in first_lower:
                    is_suspicious = True
                    reasons.append("Contains 'dicken' in first name")

                if "sider" in first_lower:
                    is_suspicious = True
                    reasons.append("Contains 'sider' in first name")

                # Check for special symbols
                if re.search(r"[/@\.#\$%\^&\*\(\)\[\]\{\}\\|<>]", first_name):
                    is_suspicious = True
                    reasons.append("Special symbols in first name")

                # Check for excessive numbers
                if re.search(r"\d{3,}", first_name):
                    is_suspicious = True
                    reasons.append("Excessive numbers in first name")

                # Check for very short names
                if len(first_name.strip()) <= 2:
                    is_suspicious = True
                    reasons.append("Very short first name")

                # Check for repeated characters
                if re.search(r"(.)\1{3,}", first_name):
                    is_suspicious = True
                    reasons.append("Repeated characters in first name")

            # Check last name
            if last_name:
                last_lower = last_name.lower()

                # Check for "dicken" or "sider"
                if "dicken" in last_lower:
                    is_suspicious = True
                    reasons.append("Contains 'dicken' in last name")

                if "sider" in last_lower:
                    is_suspicious = True
                    reasons.append("Contains 'sider' in last name")

                # Check for special symbols
                if re.search(r"[/@\.#\$%\^&\*\(\)\[\]\{\}\\|<>]", last_name):
                    is_suspicious = True
                    reasons.append("Special symbols in last name")

                # Check for excessive numbers
                if re.search(r"\d{3,}", last_name):
                    is_suspicious = True
                    reasons.append("Excessive numbers in last name")

                # Check for very short names
                if len(last_name.strip()) <= 2:
                    is_suspicious = True
                    reasons.append("Very short last name")

                # Check for repeated characters
                if re.search(r"(.)\1{3,}", last_name):
                    is_suspicious = True
                    reasons.append("Repeated characters in last name")

            # Check for empty names
            if (
                not first_name
                or not last_name
                or not first_name.strip()
                or not last_name.strip()
            ):
                is_suspicious = True
                reasons.append("Empty or whitespace-only names")

            if is_suspicious:
                suspicious_users.append(
                    {
                        "id": user_id,
                        "first_name": first_name,
                        "last_name": last_name,
                        "rfid_code": rfid_code,
                        "last_active": last_active,
                        "reasons": reasons,
                    }
                )

        print(f"📊 Total users scanned: {len(users)}")
        print(f"🚨 Suspicious users found: {len(suspicious_users)}")
        print()

        # Display suspicious users
        if suspicious_users:
            print("🚨 SUSPICIOUS USERS DETECTED:")
            print("-" * 80)

            for user in suspicious_users:
                print(f"ID: {user['id']}")
                print(f"Name: '{user['first_name']}' '{user['last_name']}'")
                print(f"RFID: {user['rfid_code']}")
                print(f"Last Active: {user['last_active']}")
                print(f"Reasons: {', '.join(user['reasons'])}")
                print("-" * 40)

        return suspicious_users

    except mysql.connector.Error as e:
        print(f"❌ Error scanning users: {e}")
        return []
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


def delete_suspicious_users(suspicious_users, confirm_delete=False):
    """Delete suspicious users from the database"""
    if not suspicious_users:
        print("✅ No suspicious users to delete!")
        return

    if not confirm_delete:
        print("⚠️  DRY RUN MODE - No users will be deleted")
        print("📝 Set confirm_delete=True to actually delete users")
        return

    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print(f"🗑️  Deleting {len(suspicious_users)} suspicious users...")

        deleted_count = 0

        for user in suspicious_users:
            try:
                user_id = user["id"]

                # First, delete related records (if any foreign key constraints exist)
                # You might need to delete from other tables that reference users

                # Delete user sessions or related data if needed
                # cursor.execute("DELETE FROM user_sessions WHERE user_id = %s", (user_id,))

                # Delete the user
                cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))

                if cursor.rowcount > 0:
                    deleted_count += 1
                    print(
                        f"✅ Deleted user ID {user_id}: '{user['first_name']}' '{user['last_name']}'"
                    )
                else:
                    print(
                        f"⚠️  User ID {user_id} was not found (may have been already deleted)"
                    )

            except mysql.connector.Error as e:
                print(f"❌ Error deleting user ID {user['id']}: {e}")

        # Commit all changes
        connection.commit()

        print(f"\n📊 CLEANUP SUMMARY:")
        print(f"   Users identified for deletion: {len(suspicious_users)}")
        print(f"   Users successfully deleted: {deleted_count}")
        print(
            f"   Users that couldn't be deleted: {len(suspicious_users) - deleted_count}"
        )

        # Verify cleanup
        cursor.execute("SELECT COUNT(*) FROM users")
        remaining_users = cursor.fetchone()[0]
        print(f"   Remaining users in database: {remaining_users}")

    except mysql.connector.Error as e:
        print(f"❌ Error during deletion process: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


def clean_user_database():
    """Main function to clean up the user database"""
    print("🧹 USER DATABASE CLEANUP TOOL")
    print("=" * 80)

    # Step 1: Identify suspicious users
    suspicious_users = identify_suspicious_users()

    if not suspicious_users:
        print("✅ No suspicious users found! Database is clean.")
        return

    print("\n" + "=" * 80)
    print("🚨 CLEANUP PREVIEW")
    print("=" * 80)

    # Step 2: Show what would be deleted (dry run)
    delete_suspicious_users(suspicious_users, confirm_delete=False)

    print("\n" + "=" * 80)
    print("🔄 ACTUAL CLEANUP")
    print("=" * 80)

    # Step 3: Ask for confirmation
    response = (
        input("⚠️  Do you want to DELETE these suspicious users? (yes/no): ")
        .strip()
        .lower()
    )

    if response in ["yes", "y"]:
        print("🗑️  Proceeding with deletion...")
        delete_suspicious_users(suspicious_users, confirm_delete=True)
        print("✅ Cleanup completed!")
    else:
        print("❌ Deletion cancelled. No users were deleted.")


def show_recent_users(limit=20):
    """Show recently created users for manual review"""
    try:
        # Connect to the database
        connection = mysql.connector.connect(**config.db_config)
        cursor = connection.cursor()

        print(f"📋 Last {limit} users created:")
        print("-" * 80)

        cursor.execute(
            """
            SELECT id, first_name, last_name, rfid_code, last_active
            FROM users 
            ORDER BY last_active DESC, id DESC
            LIMIT %s
        """,
            (limit,),
        )

        users = cursor.fetchall()

        for user_id, first_name, last_name, rfid_code, last_active in users:
            print(
                f"ID {user_id:3}: '{first_name}' '{last_name}' | RFID: {rfid_code} | Last Active: {last_active}"
            )

    except mysql.connector.Error as e:
        print(f"❌ Error retrieving users: {e}")
    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection:
            connection.close()


# Run the cleanup tool
if __name__ == "__main__":
    print("🚀 Starting user database cleanup...")
    print()

    # Show recent users first for context
    show_recent_users(20)
    print()

    # Run the main cleanup
    clean_user_database()

    print("\n🏁 User cleanup process completed!")
