"""
Application State Management
Centralized global state for quiz sessions, themes, and hardware
"""
from threading import Lock
from collections import defaultdict

# Global variables for temperature effects
virtualTemperature = 0
previous_temperature = None
previous_illuminance = None
newClient = None
current_phase = None
sensorData = None
multiplier = None

# Session tracking
session_played_themes = defaultdict(list)
session_played_lock = Lock()
MAX_THEMES_PER_SESSION = None

# Connected clients
connected_clients = set()

# Quiz state
quiz_sessions = {}
quiz_state = {}
theme_votes = {}
theme_votes_lock = Lock()
timer_lock = Lock()
session_lock = Lock()
quiz_state_lock = Lock()
active_timers = {}

# Servo control
servo_lock = Lock()
last_servo_command_time = 0.0
SERVO_COOLDOWN_SECONDS = 1.0
servo = None

# Asyncio loop (set during startup)
main_asyncio_loop = None
