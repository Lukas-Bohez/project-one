# 🔐 Sentle Admin Access

## Default Admin Password

```
sentle6967god
```

## Where to Login

Access the admin panel at:
```
https://quizthespire.com/html/sentle-admin.html
```

## Custom Password (Optional)

To set a custom admin password, add this to your `.env` file:

```bash
SENTLE_ADMIN_PASSWORD=your_custom_password_here
```

Then restart the backend server:
```bash
sudo systemctl restart quiz-backend
```

## Admin Features

Once logged in, you can:

- ✏️ **Add Sentences**: Schedule sentences for future dates
- 🗑️ **Delete Sentences**: Remove scheduled or past sentences
- ✍️ **Edit Sentences**: Modify sentence text or dates
- 🔄 **Fill Archive Gaps**: Automatically backfill missing dates in the archive
- 📊 **View Statistics**: See reuse counts and usage patterns

## Troubleshooting

**Forgot your custom password?**
1. Check your `.env` file in `/home/student/Project/project-one/backend/`
2. Or reset to default by removing the `SENTLE_ADMIN_PASSWORD` line from `.env`
3. Restart the server

**Can't login?**
- Make sure you're using the latest password
- Clear browser cache and try again
- Check browser console (F12) for errors
