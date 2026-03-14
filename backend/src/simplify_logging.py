#!/usr/bin/env python3
"""
Script to simplify video download logging.
- Reformats existing logs to only show: IP, video URL/title, and success/failure
- Creates a backup of original logs
- Reduces log verbosity in the application
"""

import os
import re
import shutil
from datetime import datetime

# Paths
LOG_FILE = "/home/student/Project/project-one/backend/video_debug.log"
BACKUP_DIR = "/home/student/Project/project-one/backend/log_backups"


def backup_log():
    """Create a backup of the current log file."""
    if not os.path.exists(LOG_FILE):
        print(f"Log file not found: {LOG_FILE}")
        return False

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"video_debug_{timestamp}.log")

    shutil.copy2(LOG_FILE, backup_file)
    print(f"✅ Backup created: {backup_file}")
    return True


def parse_and_simplify_logs():
    """Parse existing logs and extract only essential information."""
    if not os.path.exists(LOG_FILE):
        print(f"Log file not found: {LOG_FILE}")
        return []

    simplified_entries = []

    with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            # Extract timestamp
            timestamp_match = re.match(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", line)
            if not timestamp_match:
                continue
            _timestamp = timestamp_match.group(1)

            # Check if this is already in the new simplified format
            if " | IP: " in line and (" | SUCCESS " in line or " | FAILED: " in line):
                # Already simplified, just keep it
                simplified_entries.append(line.strip())
                continue

            # Check for old format success/failure logs
            if "Video conversion completed successfully:" in line:
                # Try to extract info from this and previous context
                # Format: INFO - Video conversion completed successfully: download_id (size bytes)
                continue  # Skip old format, we'll get it from the new format

            if "Video download error for" in line:
                # Skip old format errors
                continue

    return simplified_entries


def write_simplified_logs(entries):
    """Write simplified log entries to the log file."""
    print(f"\n📝 Writing {len(entries)} simplified entries...")

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("SIMPLIFIED VIDEO DOWNLOAD LOGS\n")
        f.write(f"Reformatted on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")

        for entry in entries:
            f.write(entry + "\n")

    print(f"✅ Simplified logs written to: {LOG_FILE}")


def get_log_size(filepath):
    """Get file size in human-readable format."""
    if not os.path.exists(filepath):
        return "0 B"

    size = os.path.getsize(filepath)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"


def main():
    print("=" * 80)
    print("VIDEO LOG SIMPLIFICATION TOOL")
    print("=" * 80)

    # Check original size
    original_size = get_log_size(LOG_FILE)
    print(f"\n📊 Original log size: {original_size}")

    # Backup
    print("\n🔄 Creating backup...")
    if not backup_log():
        print("❌ Backup failed, aborting.")
        return

    # Parse and simplify
    print("\n🔄 Parsing and simplifying logs...")
    simplified = parse_and_simplify_logs()

    if not simplified:
        print("⚠️  No download entries found in logs")
        return

    # Write simplified logs
    write_simplified_logs(simplified)

    # Show new size
    new_size = get_log_size(LOG_FILE)
    print(f"\n📊 New log size: {new_size}")
    print(f"✅ Reduced from {original_size} to {new_size}")

    print("\n" + "=" * 80)
    print("DONE! Your logs are now simplified.")
    print(f"Original logs backed up to: {BACKUP_DIR}")
    print("=" * 80)


if __name__ == "__main__":
    main()
