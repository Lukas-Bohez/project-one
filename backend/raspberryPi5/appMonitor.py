#!/usr/bin/env python3
# appMonitor.py - Monitor that runs your app.py directly
import subprocess
import sys
import re
import time
import os

def test_error_detection():
    """Test if our regex works"""
    test_line = "Query error: weakly-referenced object no longer exists"
    pattern = r"Query error: weakly-referenced object no longer exists"
    
    if re.search(pattern, test_line):
        print("✅ Regex pattern works correctly")
    else:
        print("❌ Regex pattern failed!")
    
def monitor_app():
    error_pattern = r"Query error: weakly-referenced object no longer exists"
    app_path = "/home/student/Project/project-one/backend/app.py"
    
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
        print("👀 Monitoring output for errors...")
        
        restart_needed = False
        line_count = 0
        
        try:
            # Monitor both stdout and stderr
            while process.poll() is None:
                # Check stdout
                try:
                    line = process.stdout.readline()
                    if line:
                        line_count += 1
                        print(f"[OUT-{line_count}] {line.strip()}")
                        
                        if re.search(error_pattern, line):
                            print("🎯 TARGET ERROR FOUND IN STDOUT! RESTARTING...")
                            restart_needed = True
                            break
                except:
                    pass
                
                # Check stderr
                try:
                    line = process.stderr.readline()
                    if line:
                        line_count += 1
                        print(f"[ERR-{line_count}] {line.strip()}")
                        
                        if re.search(error_pattern, line):
                            print("🎯 TARGET ERROR FOUND IN STDERR! RESTARTING...")
                            restart_needed = True
                            break
                except:
                    pass
                
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
            print(f"🔄 ERROR DETECTED! Restarting in 3 seconds... (restart #{restart_count})")
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
    print("🔍 APP MONITOR - Running your FastAPI app with error monitoring")
    print("📂 Target: /home/student/Project/project-one/backend/app.py")
    print("🎯 Watching for: 'Query error: weakly-referenced object no longer exists'")
    print("⌨️  Press Ctrl+C to stop both monitor and app\n")
    
    try:
        monitor_app()
    except KeyboardInterrupt:
        print("\n👋 Monitor stopped by user")
    except Exception as e:
        print(f"💥 Monitor crashed: {e}")
        sys.exit(1)