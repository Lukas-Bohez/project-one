# Deployment Checklist - YouTube Download Improvements

## ✅ Pre-Deployment

- [x] Code changes made to `app.py`
- [x] User agent rotation implemented
- [x] Request throttling added
- [x] Smart retry logic implemented
- [x] Documentation created
- [x] Maintenance scripts created
- [x] Configuration examples provided

## 🔍 Verification Steps

### 1. Check Changes Applied
```bash
cd /home/student/Project/project-one/backend
grep "YTDL_MAX_RETRIES = 10" app.py
grep "YTDL_RETRY_FOREVER = False" app.py
grep "get_random_user_agent" app.py
grep "throttle_youtube_request" app.py
```
Expected: All commands should return matches

### 2. Update Dependencies
```bash
pip install --upgrade yt-dlp
pip list | grep yt-dlp
```
Expected: yt-dlp version >= 2023.12.0

### 3. Test Maintenance Script
```bash
cd /home/student/Project/project-one/backend
./maintain_ytdlp.sh 2
```
Expected: Shows yt-dlp status and version

### 4. Check Documentation
```bash
ls -lh /home/student/Project/project-one/ | grep -E "YOUTUBE|UPGRADE|BEFORE"
```
Expected: See 4 new documentation files

## 🚀 Deployment Steps

### Step 1: Backup Current System
```bash
# Backup logs
cd /home/student/Project/project-one/backend
cp video_debug.log video_debug.log.backup_$(date +%Y%m%d)

# Verify backup
ls -lh video_debug.log*
```

### Step 2: Restart Backend Service

**If using systemd:**
```bash
sudo systemctl restart your-backend-service
sudo systemctl status your-backend-service
```

**If running manually:**
```bash
# Stop current process (Ctrl+C in terminal)
# Then start again:
cd /home/student/Project/project-one/backend
python3 app.py
```

### Step 3: Monitor Initial Requests
```bash
# In a separate terminal, watch logs
tail -f /home/student/Project/project-one/backend/video_debug.log
```

### Step 4: Test Basic Functionality
```bash
cd /home/student/Project/project-one/backend
./maintain_ytdlp.sh 5
```
Expected: Test download completes successfully

## 🧪 Testing Checklist

### Test 1: Single Video Download
- [ ] Visit your converter site
- [ ] Paste a popular YouTube video URL
- [ ] Select MP3 format
- [ ] Click convert
- [ ] Verify: Downloads within 30-60 seconds
- [ ] Check logs for "Download completed" message

### Test 2: Failed Download (Expected)
- [ ] Try an age-restricted or deleted video
- [ ] Verify: Fails within 2-5 minutes (not 15+)
- [ ] Check logs show max 10 attempts
- [ ] Verify user gets clear error message

### Test 3: Playlist Download
- [ ] Paste a small playlist URL (5-10 videos)
- [ ] Start download
- [ ] Verify: Shows progress
- [ ] Check: Multiple workers active in logs
- [ ] Verify: Completes faster than before

### Test 4: Concurrent Downloads
- [ ] Open 3 browser tabs/windows
- [ ] Start downloads in each simultaneously
- [ ] Verify: All process without blocking
- [ ] Check logs show throttling working

### Test 5: Error Recovery
- [ ] Check logs for user agent rotation
- [ ] Verify consecutive 403 detection
- [ ] Confirm smart backoff times (2-30s)
- [ ] Check no infinite retry loops

## 📊 Success Criteria

After deployment, verify these metrics:

### Immediate (First Hour)
- [ ] No server crashes or errors
- [ ] Downloads completing successfully
- [ ] Logs showing rotated user agents
- [ ] Max 10 retry attempts per failure
- [ ] Request throttling active (0.5s intervals)

### Short Term (First Day)
- [ ] Success rate: 80%+ (was 60-70%)
- [ ] Average download time: <3 minutes (was 5-15 min)
- [ ] Failure time: <5 minutes (was 15+ min)
- [ ] Log size: <100 MB (was GB range)
- [ ] No resource exhaustion

### Medium Term (First Week)
- [ ] Sustained success rate: 85%+
- [ ] User complaints reduced
- [ ] Server load stable
- [ ] No infinite retry loops observed
- [ ] Queue processing efficiently

## 🔧 Configuration (Optional)

### If Success Rate < 80%

1. **Add YouTube Cookies**
```bash
cd /home/student/Project/project-one/backend
cp .env.example .env
nano .env
# Add: YTDL_COOKIE_FILE=/path/to/cookies.txt
```
Then restart service.

2. **Configure Proxies**
```bash
nano .env
# Add: YTDL_PROXY_LIST=http://proxy1:8080,http://proxy2:8080
```
Then restart service.

### If Server Load High

1. **Reduce Workers**
```bash
nano .env
# Add: YTDL_WORKER_POOL_SIZE=6
```

2. **Increase Throttle**
Edit `app.py` line with `MIN_REQUEST_INTERVAL`:
```python
MIN_REQUEST_INTERVAL = 1.0  # Increase from 0.5 to 1.0
```

## 📈 Monitoring Commands

### Real-time Log Monitoring
```bash
tail -f backend/video_debug.log
```

### Recent Success/Failure Rate
```bash
cd backend
grep -E "Download completed|Download failed" video_debug.log | tail -50
```

### 403 Error Count
```bash
grep "403" backend/video_debug.log | wc -l
```

### Active Downloads
```bash
grep "Starting background download" backend/video_debug.log | tail -20
```

### Average Retry Count
```bash
grep "Download completed.*attempt" backend/video_debug.log | grep -oP "attempt \K\d+" | awk '{sum+=$1; count++} END {print "Average attempts:", sum/count}'
```

## 🐛 Troubleshooting

### Issue: Still getting 900+ retry attempts

**Check:**
```bash
grep "YTDL_RETRY_FOREVER" backend/app.py
```
Should show `False` not `True`

**Fix:**
Verify changes applied correctly, restart service

### Issue: All downloads failing

**Check:**
1. yt-dlp version: `yt-dlp --version`
2. ffmpeg installed: `which ffmpeg`
3. Network connectivity: `curl -I https://youtube.com`

**Fix:**
```bash
pip install --upgrade yt-dlp
sudo apt-get install ffmpeg  # if missing
```

### Issue: High server load

**Check:**
```bash
# Check worker count
grep "WORKER_POOL_SIZE = " backend/app.py

# Check active downloads
./maintain_ytdlp.sh 4
```

**Fix:**
Reduce workers in `.env` to 6

### Issue: Users getting errors

**Check:**
```bash
# Recent errors
grep ERROR backend/video_debug.log | tail -20

# 403 errors specifically
grep "403" backend/video_debug.log | tail -10
```

**Fix:**
- Update yt-dlp
- Configure cookies
- Add proxies

## 📝 Rollback Plan

If issues are severe and need to rollback:

```bash
cd /home/student/Project/project-one/backend

# Restore from git
git diff app.py  # Review changes
git checkout app.py  # Rollback if needed

# Or manually edit these values back:
# YTDL_MAX_RETRIES = 5
# YTDL_RETRY_FOREVER = True
# YTDL_BACKOFF_BASE = 1.0
# YTDL_BACKOFF_MAX = 60.0
# WORKER_POOL_SIZE = 6
# WORKER_QUEUE_MAX = 200
# MAX_CONCURRENT_DOWNLOADS_PER_IP = 3

# Then restart service
```

## ✅ Sign-Off

Once all tests pass:

- [ ] All deployment steps completed
- [ ] All tests passing
- [ ] Monitoring shows improvements
- [ ] No critical errors
- [ ] Users reporting better experience
- [ ] Documentation updated
- [ ] Team notified

**Deployment Date:** _________________

**Deployed By:** _________________

**Notes:**
_________________________________________________
_________________________________________________
_________________________________________________

---

## 📚 Related Documentation

- Full details: `YOUTUBE_IMPROVEMENTS.md`
- Quick start: `README_YOUTUBE_UPGRADE.md`
- Comparison: `BEFORE_AFTER_COMPARISON.md`
- Changes: `UPGRADE_SUMMARY.md`

## 🆘 Support

If issues persist after following this checklist:

1. Review logs: `video_debug.log`
2. Run diagnostics: `./maintain_ytdlp.sh 9`
3. Check documentation files
4. Verify all configuration settings
5. Test with simple video first
6. Check yt-dlp GitHub for known issues
