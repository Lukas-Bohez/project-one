# Manage the Spire - Database Migration Guide

## ✅ Safety Features

This migration is **100% safe** for your existing Quiz the Spire database:

1. **No existing tables are modified** - Only adds new tables with `manage_` prefix
2. **Uses `CREATE TABLE IF NOT EXISTS`** - Won't fail if tables already exist
3. **Foreign keys only reference existing tables** - Links to `users` table safely
4. **No data deletion** - Zero impact on existing quiz data
5. **Follows existing patterns** - Uses same conventions as Quiz the Spire tables

## 📋 Pre-Migration Checklist

- [ ] Database backup exists (recommended but not required)
- [ ] MySQL credentials available
- [ ] Migration script is executable (`chmod +x scripts/migrate_manage_tables.sh`)

## 🚀 Running the Migration

### Method 1: Using the Migration Script (Recommended)

```bash
cd /home/student/Project/project-one
./scripts/migrate_manage_tables.sh
```

The script will:
1. Show you which tables will be created
2. Ask for confirmation
3. Prompt for your database password
4. Run the migration
5. Verify the tables were created

### Method 2: Manual MySQL Execution

```bash
mysql -h 127.0.0.1 -u quiz_user -p quizTheSpire < backend/src/create_manage_tables.sql
```

## 📊 What Gets Created

### 16 New Tables (all prefixed with `manage_`):

1. **manage_businesses** - Company profiles
2. **manage_employee_roles** - Role definitions (owner/manager/employee)
3. **manage_employees** - Employee profiles and HR data
4. **manage_shifts** - Work schedules
5. **manage_time_entries** - Clock in/out records
6. **manage_time_off_requests** - PTO/sick leave
7. **manage_warnings** - Disciplinary actions
8. **manage_commendations** - Employee recognition
9. **manage_skills** - Skills/certifications catalog
10. **manage_employee_skills** - Employee-skill junction
11. **manage_availability** - Employee availability patterns
12. **manage_shift_swaps** - Shift trade requests
13. **manage_announcements** - Company communications
14. **manage_feedback** - Anonymous employee feedback
15. **manage_compliance_alerts** - Auto-generated compliance warnings
16. **manage_audit_logs** - Complete audit trail

## 🔗 Integration with Existing Database

The new tables integrate seamlessly:

- **manage_businesses.owner_user_id** → links to existing `users.id`
- **manage_employees.user_id** → links to existing `users.id` (optional)
- Uses same database: `quizTheSpire`
- Uses same user: `quiz_user`
- Follows same naming conventions and charset (utf8mb4)

## ✅ Verification

After migration, verify tables exist:

```bash
mysql -h 127.0.0.1 -u quiz_user -p quizTheSpire -e "SHOW TABLES LIKE 'manage_%';"
```

Should show all 16 tables.

Check table structure:

```bash
mysql -h 127.0.0.1 -u quiz_user -p quizTheSpire -e "DESCRIBE manage_businesses;"
```

## 🔄 Rollback (if needed)

If you need to remove the tables:

```bash
mysql -h 127.0.0.1 -u quiz_user -p quizTheSpire -e "
DROP TABLE IF EXISTS manage_audit_logs;
DROP TABLE IF EXISTS manage_compliance_alerts;
DROP TABLE IF EXISTS manage_feedback;
DROP TABLE IF EXISTS manage_announcements;
DROP TABLE IF EXISTS manage_shift_swaps;
DROP TABLE IF EXISTS manage_availability;
DROP TABLE IF EXISTS manage_employee_skills;
DROP TABLE IF EXISTS manage_skills;
DROP TABLE IF EXISTS manage_commendations;
DROP TABLE IF EXISTS manage_warnings;
DROP TABLE IF EXISTS manage_time_off_requests;
DROP TABLE IF EXISTS manage_time_entries;
DROP TABLE IF EXISTS manage_shifts;
DROP TABLE IF EXISTS manage_employees;
DROP TABLE IF EXISTS manage_employee_roles;
DROP TABLE IF EXISTS manage_businesses;
"
```

**Note**: This will delete all Manage the Spire data. Only use if you want to completely remove the feature.

## 🎯 Next Steps

After successful migration:

1. API endpoints will be created to interact with these tables
2. Frontend interfaces for both employers and employees
3. Integration with Quiz the Spire's main navigation

## 🆘 Troubleshooting

### "Access denied" error
- Check password for `quiz_user`
- Verify user has INSERT and CREATE privileges

### "Foreign key constraint" error
- Ensure `users` table exists in `quizTheSpire` database
- The migration should work with the existing schema

### Tables already exist
- Migration will skip existing tables (uses IF NOT EXISTS)
- This is safe and expected behavior

## 📞 Support

If you encounter any issues:
1. Check MySQL error logs
2. Verify database credentials in `backend/config/config.py`
3. Ensure MySQL server is running
