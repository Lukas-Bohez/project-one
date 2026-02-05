#!/bin/bash

# ============================================================
# Manage the Spire Database Migration Script
# Safely applies new tables to existing quizTheSpire database
# ============================================================

set -e  # Exit on any error

echo "======================================"
echo "Manage the Spire Database Migration"
echo "======================================"
echo ""

# Configuration
DB_NAME="quizTheSpire"
DB_USER="quiz_user"
DB_HOST="127.0.0.1"
DB_PORT="3306"
MIGRATION_FILE="./backend/src/create_manage_tables.sql"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found at $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will add new tables to the quizTheSpire database.${NC}"
echo "Existing tables will NOT be modified or dropped."
echo ""
echo "The following tables will be created (if they don't exist):"
echo "  - manage_businesses"
echo "  - manage_employee_roles"
echo "  - manage_employees"
echo "  - manage_shifts"
echo "  - manage_time_entries"
echo "  - manage_time_off_requests"
echo "  - manage_warnings"
echo "  - manage_commendations"
echo "  - manage_skills"
echo "  - manage_employee_skills"
echo "  - manage_availability"
echo "  - manage_shift_swaps"
echo "  - manage_announcements"
echo "  - manage_feedback"
echo "  - manage_compliance_alerts"
echo "  - manage_audit_logs"
echo ""

read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting migration...${NC}"
echo ""

# Prompt for password
echo "Please enter MySQL password for user '$DB_USER':"
read -s DB_PASS

# Run migration
if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$MIGRATION_FILE" 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
    echo ""
    echo "Verifying tables..."
    
    # Verify tables were created
    TABLES=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "SHOW TABLES LIKE 'manage_%';" 2>/dev/null | wc -l)
    
    echo -e "${GREEN}✓ Found $TABLES Manage the Spire tables${NC}"
    echo ""
    echo "You can now start using Manage the Spire!"
else
    echo ""
    echo -e "${RED}✗ Migration failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi
