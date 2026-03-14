#!/usr/bin/env python3
# appMonitor.py - Enhanced monitor with self-restart capability
import logging
import os
import queue
import re
import subprocess
import sys
import threading
import time


def setup_logging():
    """Set up logging to app.log file - only for crashes and errors"""
    log_path = "/home/student/Project/project-one/backend/app.log"

    # Create a logger for the monitor
    logger = logging.getLogger("appMonitor")
    logger.setLevel(logging.ERROR)  # Only log errors and above

    # Remove any existing handlers
    logger.handlers.clear()

    # Create file handler - only for crashes
    file_handler = logging.FileHandler(log_path, mode="a")
    file_handler.setLevel(logging.ERROR)

    # Create formatter
    formatter = logging.Formatter("%(asctime)s - CRASH - %(message)s")
    file_handler.setFormatter(formatter)

    # Add only file handler to logger (no console spam)
    logger.addHandler(file_handler)

    return logger


def test_error_detection():
    """Test if our regex works"""
    test_line = "Query error: weakly-referenced object no longer exists"
    pattern = r"Query error: weakly-referenced object no longer exists"

    if re.search(pattern, test_line):
        print("✅ Regex pattern works correctly")
    else:
        print("❌ Regex pattern failed!")


def read_stream(stream, stream_name, output_queue, activity_tracker, logger):
    """Read from a stream and put lines in queue"""
    try:
        for line in iter(stream.readline, ""):
            if line:
                activity_tracker["last_activity"] = time.time()
                output_queue.put((stream_name, line.strip()))
        stream.close()
    except Exception as e:
        error_msg = f"Stream reader error ({stream_name}): {e}"
        logger.error(error_msg)
        output_queue.put(("error", error_msg))


def cleanup_process(process):
    """Ensure process is properly cleaned up"""
    if process and process.poll() is None:
        try:
            process.terminate()
            time.sleep(1)
            if process.poll() is None:
                process.kill()
            process.wait()
        except Exception as e:
            pass


def restart_monitor():
    """Restart the monitor itself"""
    print("🔄 Restarting monitor script...")
    python = sys.executable
    os.execl(python, python, *sys.argv)


def monitor_app():
    # Set up logging
    logger = setup_logging()

    error_pattern = r"Query error: weakly-referenced object no longer exists"
    app_path = "/home/student/Project/project-one/backend/app.py"

    print("🧪 Testing error detection...")
    test_error_detection()

    restart_count = 0
    max_restarts = 100  # Allow more restarts for production use
    max_monitor_runtime = 3600 * 4  # 4 hours - restart monitor itself periodically
    monitor_start_time = time.time()

    while restart_count < max_restarts:
        # Restart monitor if it's been running too long
        if time.time() - monitor_start_time > max_monitor_runtime:
            print(
                f"⏳ Monitor has been running for {max_monitor_runtime//3600} hours - restarting..."
            )
            restart_monitor()

        start_time = time.time()
        print(f"\n🚀 Starting your app.py (attempt {restart_count + 1})...")
        print(f"📁 Running: {app_path}")

        # Run your app.py directly
        process = None
        try:
            process = subprocess.Popen(
                [sys.executable, app_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                text=True,
                cwd="/home/student/Project/project-one/backend",
            )

            logger.error(
                f"Process started - PID: {process.pid} - Attempt: {restart_count + 1}"
            )
            print(f"📋 Process PID: {process.pid}")
            print("👀 Monitoring output for specific error only...")

            # Set up activity tracking
            activity_tracker = {"last_activity": time.time()}
            output_queue = queue.Queue()

            # Start threads to read stdout and stderr
            stdout_thread = threading.Thread(
                target=read_stream,
                args=(process.stdout, "OUT", output_queue, activity_tracker, logger),
                daemon=True,
            )
            stderr_thread = threading.Thread(
                target=read_stream,
                args=(process.stderr, "ERR", output_queue, activity_tracker, logger),
                daemon=True,
            )

            stdout_thread.start()
            stderr_thread.start()

            restart_needed = False
            restart_reason = ""
            line_count = 0
            last_output_time = time.time()

            try:
                # Monitor process and output
                while process.poll() is None:
                    current_time = time.time()

                    # Check if process is hanging (no output for 5 minutes)
                    if current_time - last_output_time > 300:
                        print(
                            "⚠️ No output for 5 minutes - assuming hang, restarting..."
                        )
                        restart_needed = True
                        restart_reason = (
                            "process hang detected (no output for 5 minutes)"
                        )
                        break

                    # Check for new output (non-blocking)
                    try:
                        while True:
                            try:
                                stream_name, line = output_queue.get_nowait()
                                last_output_time = time.time()

                                if stream_name == "error":
                                    logger.error(line)
                                    print(f"⚠️ {line}")
                                    continue

                                line_count += 1
                                print(f"[{stream_name}-{line_count}] {line}")

                                # Check for the specific error pattern
                                if re.search(error_pattern, line):
                                    error_msg = f"TARGET ERROR DETECTED: {line}"
                                    logger.error(error_msg)
                                    print("🎯 TARGET ERROR FOUND! RESTARTING...")
                                    restart_needed = True
                                    restart_reason = f"specific error detected: {line}"
                                    break

                            except queue.Empty:
                                break

                        if restart_needed:
                            break

                    except Exception as e:
                        print(f"💥 Queue processing error: {e}")

                    time.sleep(0.1)

            except KeyboardInterrupt:
                print("\n🛑 Manual stop requested")
                break
            except Exception as e:
                print(f"💥 Monitor exception: {e}")

            finally:
                print("🧹 Cleaning up process...")
                cleanup_process(process)

                exit_code = process.returncode if process else -1
                print(f"📊 Process ended with code: {exit_code}")

            if restart_needed:
                restart_count += 1
                print(f"🔄 RESTART TRIGGERED! Reason: {restart_reason}")
                print(f"⏳ Restarting in 3 seconds... (restart #{restart_count})")
                time.sleep(3)
            else:
                if exit_code != 0:
                    crash_msg = f"App crashed with exit code {exit_code} - Attempt #{restart_count + 1}"
                    logger.error(crash_msg)
                    print(f"⚠️ App crashed with code {exit_code}")
                    restart_count += 1
                    print(
                        f"🔄 Restarting due to crash in 5 seconds... (restart #{restart_count})"
                    )
                    time.sleep(5)
                else:
                    print("✅ App exited cleanly")
                    break

        except Exception as launch_error:
            print(f"💥 Failed to start process: {launch_error}")
            restart_count += 1
            print(
                f"🔄 Restarting due to launch failure in 10 seconds... (restart #{restart_count})"
            )
            time.sleep(10)

    if restart_count >= max_restarts:
        print(f"⚠️ Max restarts ({max_restarts}) reached - restarting monitor")
        restart_monitor()


if __name__ == "__main__":
    print(
        "🔍 ENHANCED APP MONITOR - Running your FastAPI app with crash detection only"
    )
    print("📂 Target: /home/student/Project/project-one/backend/app.py")
    print("📝 Crash logging to: /home/student/Project/project-one/backend/app.log")
    print(
        "🎯 Only watching for: 'Query error: weakly-referenced object no longer exists'"
    )
    print("🔄 Includes monitor self-restart capability")
    print("⌨️  Press Ctrl+C to stop both monitor and app\n")

    try:
        monitor_app()
    except KeyboardInterrupt:
        print("\n👋 Monitor stopped by user")
    except Exception as e:
        print(f"💥 Monitor crashed: {e}")
        print("🚀 Attempting to restart monitor in 10 seconds...")
        time.sleep(10)
        restart_monitor()
