#!/usr/bin/env python3
# appMonitor.py - Monitor that runs your app.py directly with activity detection
import subprocess
import sys
import re
import time
import os
import threading
import queue

def test_error_detection():
    """Test if our regex works"""
    test_line = "Query error: weakly-referenced object no longer exists"
    pattern = r"Query error: weakly-referenced object no longer exists"
    
    if re.search(pattern, test_line):
        print("✅ Regex pattern works correctly")
    else:
        print("❌ Regex pattern failed!")

def read_stream(stream, stream_name, output_queue, activity_tracker):
    """Read from a stream and put lines in queue"""
    try:
        for line in iter(stream.readline, ''):
            if line:
                activity_tracker['last_activity'] = time.time()
                output_queue.put((stream_name, line.strip()))
        stream.close()
    except Exception as e:
        output_queue.put(('error', f"Stream reader error ({stream_name}): {e}"))

def monitor_app():
    error_pattern = r"Query error: weakly-referenced object no longer exists"
    app_path = "/home/student/Project/project-one/backend/app.py"
    activity_timeout = 1.0  # 1 second timeout for activity detection
    
    print("🧪 Testing error detection...")
    test_error_detection()
    
    restart_count = 0
    max_restarts = 100  # Allow more restarts for production use
    
    while restart_count < max_restarts:
        print(f"\n🚀 Starting your app.py (attempt {restart_count + 1})...")
        print(f"📁 Running: {app_path}")
        
        # Run your app.py directly
        process = subprocess.Popen(
            [sys.executable, app_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            text=True,
            cwd="/home/student/Project/project-one/backend"  # Set working directory
        )
        
        print(f"📋 Process PID: {process.pid}")
        print("👀 Monitoring output for errors and activity...")
        
        # Set up activity tracking
        activity_tracker = {'last_activity': time.time()}
        output_queue = queue.Queue()
        
        # Start threads to read stdout and stderr
        stdout_thread = threading.Thread(
            target=read_stream, 
            args=(process.stdout, 'OUT', output_queue, activity_tracker),
            daemon=True
        )
        stderr_thread = threading.Thread(
            target=read_stream, 
            args=(process.stderr, 'ERR', output_queue, activity_tracker),
            daemon=True
        )
        
        stdout_thread.start()
        stderr_thread.start()
        
        restart_needed = False
        restart_reason = ""
        line_count = 0
        
        try:
            # Monitor process and output
            while process.poll() is None:
                current_time = time.time()
                
                # Check for new output (non-blocking)
                try:
                    while True:
                        try:
                            stream_name, line = output_queue.get_nowait()
                            if stream_name == 'error':
                                print(f"⚠️ {line}")
                                continue
                                
                            line_count += 1
                            print(f"[{stream_name}-{line_count}] {line}")
                            
                            # Check for the specific error pattern
                            if re.search(error_pattern, line):
                                print("🎯 TARGET ERROR FOUND! RESTARTING...")
                                restart_needed = True
                                restart_reason = "specific error detected"
                                break
                                
                        except queue.Empty:
                            break
                            
                    if restart_needed:
                        break
                        
                except Exception as e:
                    print(f"💥 Queue processing error: {e}")
                
                # Check for activity timeout (only after initial startup period)
                if current_time - activity_tracker['last_activity'] > activity_timeout:
                    # Give the app some time to start up initially
                    startup_grace_period = 10.0  # 10 seconds grace period on startup
                    if current_time - activity_tracker['last_activity'] < startup_grace_period:
                        time.sleep(0.1)
                        continue
                    
                    print(f"⏰ No activity detected for {activity_timeout} seconds!")
                    print("🔄 Assuming server has stopped - restarting...")
                    restart_needed = True
                    restart_reason = "no activity timeout"
                    break
                
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\n🛑 Manual stop requested")
            break
        except Exception as e:
            print(f"💥 Monitor exception: {e}")
        
        finally:
            print("🧹 Cleaning up process...")
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    print("💀 Force killing process...")
                    process.kill()
                    process.wait()
            print(f"📊 Process ended with code: {process.returncode}")
        
        if restart_needed:
            restart_count += 1
            print(f"🔄 RESTART TRIGGERED! Reason: {restart_reason}")
            print(f"⏳ Restarting in 3 seconds... (restart #{restart_count})")
            time.sleep(3)
        else:
            if process.returncode != 0:
                print(f"⚠️ App crashed with code {process.returncode}")
                restart_count += 1
                print(f"🔄 Restarting due to crash in 5 seconds... (restart #{restart_count})")
                time.sleep(5)
            else:
                print("✅ App exited cleanly")
                break
    
    if restart_count >= max_restarts:
        print(f"⚠️ Max restarts ({max_restarts}) reached - stopping monitor")

if __name__ == "__main__":
    print("🔍 ENHANCED APP MONITOR - Running your FastAPI app with error and activity monitoring")
    print("📂 Target: /home/student/Project/project-one/backend/app.py")
    print("🎯 Watching for: 'Query error: weakly-referenced object no longer exists'")
    print("⏰ Activity timeout: 1 second (will restart if no logs for 1 second)")
    print("⌨️  Press Ctrl+C to stop both monitor and app\n")
    
    try:
        monitor_app()
    except KeyboardInterrupt:
        print("\n👋 Monitor stopped by user")
    except Exception as e:
        print(f"💥 Monitor crashed: {e}")
        sys.exit(1)