# Mass Question Migration System

## Overview
A complete mass migration system for moving questions between themes in the admin interface.

## Backend Implementation

### API Endpoint
- **URL**: `POST /api/v1/themes/{source_theme_id}/migrate-to/{target_theme_id}`
- **Authentication**: Requires admin authentication via `X-User-ID` and `X-RFID` headers
- **Function**: Migrates all questions from source theme to target theme

### Database Repository Method
- **Method**: `QuestionRepository.migrate_questions_to_theme(source_theme_id, target_theme_id)`
- **Location**: `backend/database/datarepository.py`
- **Function**: Updates all questions in source theme to use target theme ID

### Features
- ✅ Admin-only access control
- ✅ Theme existence validation
- ✅ Prevents migration to same theme
- ✅ Checks if source theme has questions
- ✅ Audit logging for migrations
- ✅ Detailed response with migration summary
- ✅ Comprehensive error handling

## Frontend Implementation

### UI Components
- **Location**: Admin themes tab (`frontend/html/admin.html`)
- **Components**:
  - Source theme dropdown (with question counts)
  - Target theme dropdown
  - Migration button with dynamic state
  - Info text showing migration status

### JavaScript Functions
- **Location**: `frontend/js/admin.js`
- **Functions**:
  - `populateMigrationDropdowns()` - Fills dropdowns with theme data
  - `updateMigrationButtonState()` - Updates button and info based on selections
  - `migrateQuestionsToTheme()` - Makes API call to perform migration
  - `handleMigrationClick()` - Handles button click with confirmation

### CSS Styling
- **Location**: `frontend/css/admin.css`
- **Features**:
  - Migration panel styling
  - Responsive design for mobile
  - State-based info text colors (error, warning, success)
  - Disabled button styling

### UI Features
- ✅ Dynamic dropdown population
- ✅ Real-time validation feedback
- ✅ Question count display
- ✅ Confirmation dialog
- ✅ Loading states during migration
- ✅ Success/error notifications
- ✅ Automatic data refresh after migration

## Usage Instructions

### For Admins
1. **Access**: Login to admin interface with admin credentials
2. **Navigate**: Go to the "Themes" tab
3. **Select Source**: Choose the theme to migrate questions FROM (shows question count)
4. **Select Target**: Choose the theme to migrate questions TO
5. **Migrate**: Click "Migrate All Questions" button
6. **Confirm**: Confirm the action in the dialog
7. **Result**: Watch for success notification and updated counts

### Validation Rules
- Both source and target themes must be selected
- Source and target must be different themes
- Source theme must contain questions
- User must have admin privileges
- Both themes must exist in database

## API Response Format

### Success Response
```json
{
  "status": "success", 
  "message": "Successfully migrated 15 questions",
  "source_theme": {
    "id": 1,
    "name": "Old Theme"
  },
  "target_theme": {
    "id": 2, 
    "name": "New Theme"
  },
  "migrated_count": 15,
  "migration_timestamp": "2025-09-27T10:30:00",
  "migrated_by": 123
}
```

### Error Response
```json
{
  "detail": "Source theme 'Old Theme' has no questions to migrate"
}
```

## Security Features
- ✅ Admin-only endpoint access
- ✅ User authentication validation
- ✅ IP address logging
- ✅ Audit trail creation
- ✅ Input validation and sanitization
- ✅ Database transaction safety

## Technical Details

### Database Operation
```sql
UPDATE questions SET themeId = ? WHERE themeId = ?
```

### Event Flow
1. User selects themes in UI
2. Frontend validates selection
3. User clicks migrate button
4. JavaScript shows confirmation dialog
5. API call made to migration endpoint
6. Backend validates authentication and data
7. Database migration performed
8. Audit log created
9. Response sent to frontend
10. UI updates with new data

## Testing
- Backend endpoint compiles successfully
- Frontend JavaScript compiles without errors
- CSS styling is responsive and accessible
- Integration with existing admin system complete

## Files Modified
- `backend/app.py` - Added migration endpoint
- `backend/database/datarepository.py` - Added migration method
- `frontend/html/admin.html` - Added migration UI
- `frontend/css/admin.css` - Added migration styles
- `frontend/js/admin.js` - Added migration functionality

## Next Steps
1. Test in development environment
2. Verify with actual theme data
3. Test error scenarios
4. Deploy to production when ready