# Deployment Checklist - API Overload Fix

## Pre-Deployment Verification

### ✅ Step 1: Verify Files Created
```bash
cd /home/student/Project/project-one/backend

# Check if all files exist
ls -l gunicorn.conf.py
ls -l start-backend-production.sh
ls -l start-backend-dev.sh
ls -l restart-backend-production.sh
```

Expected: All files should exist and be executable (scripts should have 'x' permission)

### ✅ Step 2: Verify Gunicorn Installed
```bash
source /home/student/Project/.venv/bin/activate
pip list | grep gunicorn
```

Expected: `gunicorn  23.0.0` or similar

### ✅ Step 3: Check Database Connection
```bash
mysql -u quiz_user -p -h 127.0.0.1 quizTheSpire -e "SELECT 1;"
```

Expected: Returns `1` without errors

### ✅ Step 4: Verify Port 8001 Available
```bash
ss -tlnp | grep 8001
```

Expected: Either nothing (port free) or your old backend (which we'll stop)

## Deployment Steps

### 🚀 Step 1: Stop Old Backend
```bash
cd /home/student/Project/project-one/backend

# Kill all old processes
pkill -f 'uvicorn.*app:app'
pkill -f 'gunicorn.*app:app'
pkill -f 'python.*app.py'

# Wait for cleanup
sleep 3

# Verify nothing running on 8001
ss -tlnp | grep 8001
```

Expected: No output (port is free)

### 🚀 Step 2: Start Production Backend
```bash
cd /home/student/Project/project-one/backend
./restart-backend-production.sh
```

Expected output:
```
🔧 QuizTheSpire Backend - Complete Restart
==========================================

✅ Activating virtual environment...
🛑 Stopping all existing backend processes...
⏳ Waiting for cleanup...

🚀 Starting backend in PRODUCTION mode...
   Workers: 4 (handles ~4000 concurrent connections)
   ...

✅ Backend started successfully!
   PID: 12345
   API: http://localhost:8001
```

### 🚀 Step 3: Verify Workers Running
```bash
ps aux | grep gunicorn
```

Expected: 5 processes total (1 master + 4 workers)
```
student  12345  ... gunicorn: master [app:app]
student  12346  ... gunicorn: worker [app:app]
student  12347  ... gunicorn: worker [app:app]
student  12348  ... gunicorn: worker [app:app]
student  12349  ... gunicorn: worker [app:app]
```

### 🚀 Step 4: Test API Endpoint
```bash
curl http://localhost:8001/
```

Expected: Returns a response (not a connection error)

### 🚀 Step 5: Check Error Logs
```bash
tail -20 logs/gunicorn_error.log
```

Expected: No critical errors, should show workers starting

## Post-Deployment Testing

### 🧪 Test 1: Basic API Call
```bash
curl -I http://localhost:8001/api/v1/questions/
```

Expected: `HTTP/1.1 200 OK` or `HTTP/1.1 404 Not Found` (both are fine - means server is responding)

### 🧪 Test 2: Load Test (Optional)
```bash
# Install apache bench if not present
sudo apt-get install apache2-utils

# Test with 100 concurrent users
ab -n 1000 -c 100 http://localhost:8001/
```

Expected:
- Complete requests: 1000
- Failed requests: 0
- Requests per second: >100

### 🧪 Test 3: Database Connection Under Load
```bash
# Watch error log while load testing
tail -f logs/gunicorn_error.log &

# Run load test
ab -n 500 -c 50 http://localhost:8001/api/v1/users/

# Stop tail
killall tail
```

Expected: No database connection errors in log

### 🧪 Test 4: Worker Health Check
```bash
# Workers should stay alive
ps aux | grep gunicorn | wc -l
```

Expected: Always 5 (1 master + 4 workers)

## Monitoring Setup

### 📊 Real-Time Access Log
```bash
tail -f logs/gunicorn_access.log
```

Shows: Every request with timestamp, status code, and response time

### 📊 Real-Time Error Log
```bash
tail -f logs/gunicorn_error.log
```

Shows: Errors, worker lifecycle events, and warnings

### 📊 Resource Monitoring
```bash
# CPU and memory usage
top -p $(pgrep -d, -f 'gunicorn.*app:app')
```

Expected: CPU <50% per worker, Memory stable

## Success Criteria

Your deployment is successful when ALL of these are true:

- [ ] 5 gunicorn processes running (1 master + 4 workers)
- [ ] Port 8001 responding to requests
- [ ] No errors in `logs/gunicorn_error.log`
- [ ] Load test completes with 0 failed requests
- [ ] Workers stay alive under load
- [ ] Response times <200ms for simple endpoints
- [ ] Database connections working
- [ ] No "Connection refused" errors

## Rollback Plan (If Needed)

If something goes wrong, rollback to old setup:

```bash
# 1. Stop new backend
pkill -f 'gunicorn.*app:app'

# 2. Start old backend
cd /home/student/Project/project-one/backend
source /home/student/Project/.venv/bin/activate
python app.py
```

## Maintenance Commands

### Restart Backend
```bash
cd /home/student/Project/project-one/backend
./restart-backend-production.sh
```

### Stop Backend
```bash
pkill -f 'gunicorn.*app:app'
```

### View Logs
```bash
# Last 50 lines of errors
tail -50 logs/gunicorn_error.log

# Live error monitoring
tail -f logs/gunicorn_error.log
```

### Check Worker Status
```bash
# Count workers
ps aux | grep gunicorn | wc -l

# Detailed worker info
ps aux | grep gunicorn
```

## Troubleshooting

### Issue: No processes running after start
**Check:**
```bash
cat logs/gunicorn_error.log | tail -50
```
**Common causes:**
- Port already in use
- Permission issues
- Python import errors

### Issue: Workers keep dying
**Check:**
```bash
grep -i "worker" logs/gunicorn_error.log | tail -20
```
**Common causes:**
- Out of memory
- Database connection timeout
- Code errors

### Issue: "Address already in use"
**Fix:**
```bash
pkill -9 -f 'gunicorn'
sleep 2
./restart-backend-production.sh
```

### Issue: Database errors
**Check:**
```bash
mysql -u quiz_user -p -h 127.0.0.1 -e "SHOW PROCESSLIST;"
```
**Fix:** May need to increase MySQL max_connections

## Expected Performance

With the new configuration:

| Metric | Value |
|--------|-------|
| Max Concurrent Users | ~4000 |
| Average Response Time | <100ms |
| Failed Requests | 0% |
| Worker Uptime | 99.9% |
| API Timeout Issues | None |

## Support Contacts

If deployment fails:
1. Check logs first: `logs/gunicorn_error.log`
2. Verify MySQL running: `sudo systemctl status mysql`
3. Test database: `mysql -u quiz_user -p`
4. Check port: `ss -tlnp | grep 8001`

---

**Deployment Date**: [Fill in when deployed]
**Deployed By**: [Your name]
**Status**: [ ] Success [ ] Issues [ ] Rollback
**Notes**: ____________________
