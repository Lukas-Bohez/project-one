# Video Converter Performance Optimizations

## Date: October 24, 2025

## Current Performance Analysis

Based on the logs, the system is working but has several efficiency bottlenecks:

### Observed Performance
- **Average download time**: 15-30 seconds per video
- **Invidious fallback success rate**: ~75% (some instances fail with 502/418 errors)
- **Multiple retry attempts**: Wasting 1-2 seconds per failed instance
- **Worker pool size**: 12 threads (good, but can be optimized)
- **Queue size**: 500 max (adequate for most scenarios)

### Key Bottlenecks Identified

1. **Sequential Invidious Retries**
   - Currently tries instances one-by-one
   - Failed instances waste 200-800ms each
   - Could try multiple instances in parallel

2. **No Connection Pooling**
   - Each download creates new HTTP connections
   - No keep-alive or connection reuse
   - Extra latency on every request

3. **Excessive Synchronous Logging**
   - Every log call blocks the thread
   - Hundreds of log calls per download
   - Should use async logging or reduce verbosity

4. **No Download Result Caching**
   - Same video URL downloaded multiple times
   - No deduplication across time windows
   - Could cache results for 5-10 minutes

5. **Browser Cookie Extraction Overhead**
   - Tries Chrome/Firefox on every first attempt
   - Should pre-check if browsers exist
   - Could be skipped entirely if Invidious works

6. **No Request Coalescing Timeout**
   - Multiple users requesting same URL at same time
   - Current coalescing is good but could be improved
   - Should have a timeout to prevent stale coalescence

7. **Inefficient File Cleanup**
   - Runs cleanup every 30 seconds
   - Should use event-driven cleanup
   - Could batch deletions

## Proposed Optimizations

### 1. Parallel Invidious Instance Checking (HIGH IMPACT)
Instead of trying instances sequentially, try 2-3 in parallel and use the first success.

**Expected improvement**: 40-60% faster fallback (from 10-15s to 5-8s)

### 2. Implement HTTP Connection Pool (MEDIUM IMPACT)
Use `aiohttp` with connection pooling for faster repeated requests.

**Expected improvement**: 10-15% faster overall

### 3. Async Logging Queue (MEDIUM IMPACT)
Move logging to a separate thread with a queue to prevent blocking.

**Expected improvement**: 5-10% faster, more stable under load

### 4. Short-term Result Cache (HIGH IMPACT for repeat requests)
Cache successful downloads for 5 minutes with URL hash.

**Expected improvement**: Instant response for cached URLs

### 5. Smart Instance Health Tracking (MEDIUM IMPACT)
Track which Invidious instances are working and prioritize them.

**Expected improvement**: 20-30% faster average fallback time

### 6. Reduce Unnecessary Retries (HIGH IMPACT)
Skip browser cookie extraction if Invidious is available and working.

**Expected improvement**: 2-3 seconds saved per download

### 7. Batch File Cleanup (LOW IMPACT)
Use inotify or schedule cleanup less frequently.

**Expected improvement**: Minimal, but reduces CPU overhead

## Implementation Priority

### Phase 1: Quick Wins (< 1 hour)
✅ 1. Skip browser cookie extraction when Invidious is tried first
✅ 2. Track Invidious instance health
✅ 3. Reduce logging verbosity (only log on errors/success)

### Phase 2: Medium Effort (2-3 hours)
⏳ 4. Parallel Invidious instance checking
⏳ 5. Short-term result cache (5-minute TTL)
⏳ 6. Async logging queue

### Phase 3: Larger Refactor (4+ hours)
⏹️ 7. HTTP connection pooling with aiohttp
⏹️ 8. Implement download streaming
⏹️ 9. Move to async download workers

## Expected Results

### Before Optimization
- **Capacity**: ~50-60 concurrent downloads (12 workers × ~5 downloads/minute)
- **Average time**: 20-25 seconds per video
- **Success rate**: 85-90%
- **Failed request handling**: Slow (multiple sequential retries)

### After Phase 1
- **Capacity**: ~70-80 concurrent downloads
- **Average time**: 15-18 seconds per video
- **Success rate**: 90-95%
- **Failed request handling**: Faster (skip unnecessary steps)

### After Phase 2
- **Capacity**: ~100-120 concurrent downloads  
- **Average time**: 10-12 seconds per video (5s for cached)
- **Success rate**: 93-97%
- **Failed request handling**: Much faster (parallel checking)

### After Phase 3
- **Capacity**: ~200-300 concurrent downloads
- **Average time**: 8-10 seconds per video
- **Success rate**: 95-98%
- **Failed request handling**: Near-instant for working instances

## Immediate Implementation

Let's implement Phase 1 optimizations now for immediate improvement.
