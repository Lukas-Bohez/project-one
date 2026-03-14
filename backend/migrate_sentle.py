#!/usr/bin/env python3
"""
Sentle Database Migration Script
Adds reuse_count column to sentle_sentences and creates sentle_daily_sentences table
"""

import os
import sys

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(__file__))

from database.database import Database


def migrate():
    """Run migration to update Sentle database schema"""

    print("=" * 60)
    print("Sentle Database Migration")
    print("=" * 60)

    try:
        # Step 1: Add reuse_count column to sentle_sentences if it doesn't exist
        print("\n[1/3] Checking sentle_sentences table...")

        columns = Database.get_rows("SHOW COLUMNS FROM sentle_sentences")
        has_reuse_count = any(
            col.get("Field") == "reuse_count" for col in (columns or [])
        )

        if not has_reuse_count:
            print("  → Adding reuse_count column...")
            Database.execute_sql(
                "ALTER TABLE sentle_sentences ADD COLUMN reuse_count INT DEFAULT 0 AFTER used"
            )
            print("  ✓ reuse_count column added")
        else:
            print("  ✓ reuse_count column already exists")

        # Step 2: Create sentle_daily_sentences table if it doesn't exist
        print("\n[2/3] Checking sentle_daily_sentences table...")

        tables = Database.get_rows("SHOW TABLES LIKE 'sentle_daily_sentences'")

        if not tables:
            print("  → Creating sentle_daily_sentences table...")
            Database.execute_sql("""
                CREATE TABLE IF NOT EXISTS sentle_daily_sentences (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    sentence_id INT NOT NULL,
                    is_reused BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sentence_id) REFERENCES sentle_sentences(id) ON DELETE CASCADE,
                    INDEX idx_date (date)
                )
            """)
            print("  ✓ sentle_daily_sentences table created")
        else:
            print("  ✓ sentle_daily_sentences table already exists")

        # Step 3: Populate sentle_daily_sentences with historical data
        print("\n[3/3] Populating sentle_daily_sentences with historical data...")

        # Get all used sentences
        used_sentences = Database.get_rows(
            "SELECT id, date FROM sentle_sentences WHERE used = TRUE ORDER BY date ASC"
        )

        if used_sentences:
            added = 0
            skipped = 0

            for sentence in used_sentences:
                # Check if already recorded
                existing = Database.get_one_row(
                    "SELECT id FROM sentle_daily_sentences WHERE date = %s",
                    (sentence["date"],),
                )

                if not existing:
                    Database.execute_sql(
                        "INSERT INTO sentle_daily_sentences (date, sentence_id, is_reused) VALUES (%s, %s, FALSE)",
                        (sentence["date"], sentence["id"]),
                    )
                    added += 1
                else:
                    skipped += 1

            print(f"  ✓ Added {added} historical entries (skipped {skipped} existing)")
        else:
            print("  ℹ No historical sentences to populate")

        # Step 4: Fill gaps in archive (backfill all missing dates)
        print("\n[4/4] Backfilling missing dates in archive...")

        from datetime import datetime, timedelta

        date_range = Database.get_one_row(
            "SELECT MIN(date) as first_date, MAX(date) as last_date FROM sentle_sentences WHERE used = TRUE"
        )

        if date_range and date_range.get("first_date"):
            first_date = date_range["first_date"]
            today = datetime.now().date()
            yesterday = today - timedelta(days=1)
            last_date = (
                min(yesterday, date_range["last_date"])
                if date_range.get("last_date")
                else yesterday
            )

            current_date = first_date
            backfilled = 0

            while current_date <= last_date:
                existing = Database.get_one_row(
                    "SELECT id FROM sentle_daily_sentences WHERE date = %s",
                    (current_date,),
                )

                if not existing:
                    # Find scheduled sentence for this date
                    scheduled = Database.get_one_row(
                        "SELECT id FROM sentle_sentences WHERE date = %s",
                        (current_date,),
                    )

                    if scheduled:
                        Database.execute_sql(
                            "INSERT INTO sentle_daily_sentences (date, sentence_id, is_reused) VALUES (%s, %s, FALSE)",
                            (current_date, scheduled["id"]),
                        )
                        backfilled += 1
                    else:
                        # Use oldest sentence with lowest reuse count
                        reusable = Database.get_one_row(
                            """SELECT id FROM sentle_sentences 
                               WHERE used = TRUE AND date < %s
                               ORDER BY reuse_count ASC, date ASC 
                               LIMIT 1""",
                            (current_date,),
                        )

                        if reusable:
                            Database.execute_sql(
                                "INSERT INTO sentle_daily_sentences (date, sentence_id, is_reused) VALUES (%s, %s, TRUE)",
                                (current_date, reusable["id"]),
                            )
                            Database.execute_sql(
                                "UPDATE sentle_sentences SET reuse_count = reuse_count + 1 WHERE id = %s",
                                (reusable["id"],),
                            )
                            backfilled += 1

                current_date += timedelta(days=1)

            print(f"  ✓ Backfilled {backfilled} missing dates")
        else:
            print("  ℹ No date range to backfill")

        print("\n" + "=" * 60)
        print("✓ Migration completed successfully!")
        print("=" * 60)
        print("\nNew features enabled:")
        print("  • Sentences can be reused when none scheduled")
        print("  • Reuse count tracking to balance sentence rotation")
        print("  • All dates appear in archive (even with zero plays)")
        print("  • Admin can edit and delete sentences")
        print("=" * 60 + "\n")

    except Exception as e:
        print("\n" + "=" * 60)
        print("✗ Migration failed!")
        print("=" * 60)
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    migrate()
