import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
import time
import traceback
from threading import Thread, Event
import socket
# Import the new ThemeRepository
from database.datarepository import QuestionRepository, AnswerRepository, ThemeRepository 
from models.models import (
    QuestionBase, QuestionCreate, QuestionResponse, QuestionUpdate,
    QuestionStatusUpdate, ErrorNotFound, QuestionWithAnswers,
    ThemeBase, ThemeCreate, ThemeUpdate, ThemeResponse, # Import new Theme models
    DifficultyLevelResponse, QuestionSearchResult,
    RandomQuestionRequest, QuestionMetadataUpdate,
    QuestionActivationNotification,
    AnswerBase, AnswerCreate, AnswerListResponse, AnswerResponse, 
    AnswerStatusUpdate, AnswerUpdate, CorrectAnswerResponse
)
from typing import Optional, List
from fastapi import Request
from fastapi import Query, Depends
from models.models import User, UserCreate, UserUpdate, UserPublic # Import your new user models
from database.datarepository import UserRepository
from models.models import ErrorMessage,ErrorNotFound

try:
    from raspberryPi5.RFIDYReaderske import HardcoreRFID
    from raspberryPi5.servomotor import ServoMotor
    from raspberryPi5.temperature import TemperatureSensor
    from raspberryPi5.mcpLighty import LightSensor
    from raspberryPi5.lcd import LCD1602A
    RPI_COMPONENTS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Raspberry Pi components not found or failed to import: {e}")
    print("The Pi-related background thread will not start.")
    RPI_COMPONENTS_AVAILABLE = False


# ----------------------------------------------------
# App setup
# ----------------------------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # This should allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='asgi', logger=True)
sio_app = socketio.ASGIApp(sio, app) # <-- THIS IS THE KEY

ENDPOINT = "/api/v1"  # API base endpoint

# ----------------------------------------------------
# FastAPI Endpoints - Questions (Existing, unchanged)
# ----------------------------------------------------

@app.get("/")
async def root():
    return "Quiz API Server is running. Use the API endpoints to interact with the system."

@app.get(
    ENDPOINT + "/questions/",
    summary="Get all questions",
    response_model=list[QuestionResponse],
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def get_all_questions(active_only: bool = False):
    questions = QuestionRepository.get_all_questions(active_only)
    if not questions:
        raise HTTPException(
            status_code=404,
            detail="No questions found"
        )
    return questions

@app.get(
    ENDPOINT + "/questions/{question_id}/",
    summary="Get question by ID",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def get_question_by_id(question_id: int):
    question = QuestionRepository.get_question_by_id(question_id)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return question

@app.post(
    ENDPOINT + "/questions/",
    summary="Create a new question",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Questions"]
)
async def create_question(question: QuestionCreate):
    new_id = QuestionRepository.create_question(**question.dict())
    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create question"
        )
    return QuestionRepository.get_question_by_id(new_id)

@app.put(
    ENDPOINT + "/questions/{question_id}/",
    summary="Update a question",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def update_question(question_id: int, question: QuestionUpdate):
    updated = QuestionRepository.update_question(question_id, **question.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found or update failed"
        )
    return QuestionRepository.get_question_by_id(question_id)

@app.patch(
    ENDPOINT + "/questions/{question_id}/status/",
    summary="Update question status (active/inactive)",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def update_question_status(question_id: int, status: QuestionStatusUpdate):
    updated = QuestionRepository.update_question(
        question_id,
        is_active=status.is_active
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    await sio.emit('question_status_changed', {
        "question_id": question_id,
        "new_status": status.is_active
    })
    return QuestionRepository.get_question_by_id(question_id)

@app.delete(
    ENDPOINT + "/questions/{question_id}/",
    summary="Delete a question",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def delete_question(question_id: int):
    success = QuestionRepository.delete_question(question_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

# ----------------------------------------------------
# FastAPI Endpoints - Special Question Operations (Existing, unchanged)
# ----------------------------------------------------

@app.get(
    ENDPOINT + "/questions/random/",
    summary="Get a random question",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def get_random_question(params: RandomQuestionRequest = Body(default=None)):
    question = QuestionRepository.get_random_question(
        themeId=params.themeId if params else None,
        difficultyLevelId=params.difficultyLevelId if params else None
    )
    if not question:
        raise HTTPException(
            status_code=404,
            detail="No active questions found matching criteria"
        )
    return question

@app.get(
    ENDPOINT + "/questions/{question_id}/with-answers/",
    summary="Get question with answers",
    response_model=QuestionWithAnswers,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def get_question_with_answers(question_id: int):
    question = QuestionRepository.get_questions_with_answers(question_id)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return question

@app.patch(
    ENDPOINT + "/questions/{question_id}/metadata/",
    summary="Update question metadata",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def update_question_metadata(question_id: int, metadata: QuestionMetadataUpdate):
    updated = QuestionRepository.update_question_metadata(
        question_id,
        **metadata.dict(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return QuestionRepository.get_question_by_id(question_id)

# ----------------------------------------------------
# Socket.IO Handlers (Existing, unchanged)
# ----------------------------------------------------

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def request_random_question(sid, data):
    theme_id = data.get('themeId')
    difficulty_id = data.get('difficultyLevelId')
    question = QuestionRepository.get_random_question(theme_id, difficulty_id)
    if question:
        await sio.emit('new_question', question, room=sid)

# ----------------------------------------------------
# FastAPI Endpoints - Answers (Existing, unchanged)
# ----------------------------------------------------

@app.post(
    ENDPOINT + "/questions/{question_id}/answers/",
    summary="Create a new answer for a question",
    response_model=AnswerResponse,
    status_code=status.HTTP_201_CREATED,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def create_answer(question_id: int, answer: AnswerCreate):
    # Verify question exists
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    new_id = AnswerRepository.create_answer(
        questionId=question_id,
        answer_text=answer.answer_text,
        is_correct=answer.is_correct
    )

    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create answer"
        )
    return AnswerRepository.get_answer_by_id(new_id)


@app.get(
    ENDPOINT + "/questions/{question_id}/answers/",
    summary="Get all answers for a question",
    response_model=AnswerListResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_answers_for_question(question_id: int):
    # Verify question exists
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    answers = AnswerRepository.get_all_answers_for_question(question_id)
    return AnswerListResponse(
        answers=answers,
        count=len(answers)
    )

@app.get(
    ENDPOINT + "/questions/{question_id}/answers/correct/",
    summary="Get correct answers for a question",
    response_model=CorrectAnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_correct_answers(question_id: int):
    # Verify question exists
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    answers = AnswerRepository.get_correct_answers_for_question(question_id)
    return CorrectAnswerResponse(
        correct_answers=answers,
        count=len(answers)
    )

@app.get(
    ENDPOINT + "/answers/{answer_id}/",
    summary="Get answer by ID",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_answer(answer_id: int):
    answer = AnswerRepository.get_answer_by_id(answer_id)
    if not answer:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found"
        )
    return answer

@app.put(
    ENDPOINT + "/answers/{answer_id}/",
    summary="Update an answer",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def update_answer(answer_id: int, answer: AnswerUpdate):
    updated = AnswerRepository.update_answer(
        answer_id,
        **answer.dict(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found or update failed"
        )
    return AnswerRepository.get_answer_by_id(answer_id)

@app.patch(
    ENDPOINT + "/answers/{answer_id}/correctness/",
    summary="Update answer correctness status",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def update_answer_correctness(answer_id: int, status: AnswerStatusUpdate):
    updated = AnswerRepository.update_answer(
        answer_id,
        is_correct=status.is_correct
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found"
        )
    return AnswerRepository.get_answer_by_id(answer_id)

@app.delete(
    ENDPOINT + "/answers/{answer_id}/",
    summary="Delete an answer",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def delete_answer(answer_id: int):
    success = AnswerRepository.delete_answer(answer_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found"
        )

# ----------------------------------------------------
# Special Answer Operations (Existing, unchanged)
# ----------------------------------------------------

@app.put(
    ENDPOINT + "/questions/{question_id}/answers/set-correct/",
    summary="Set a specific answer as the correct one (makes others incorrect)",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Answer Operations"]
)
async def set_correct_answer(question_id: int, answer_id: int):
    # Verify both question and answer exist
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    answer = AnswerRepository.get_answer_by_id(answer_id)
    if not answer or answer['questionId'] != question_id:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found for this question"
        )

    updated = AnswerRepository.set_single_correct_answer_for_question(
        question_id,
        answer_id
    )

    if not updated:
        raise HTTPException(
            status_code=400,
            detail="Failed to update answer correctness"
        )

    return AnswerRepository.get_answer_by_id(answer_id)


# ----------------------------------------------------
# FastAPI Endpoints - Themes (NEW)
# ----------------------------------------------------

@app.post(
    ENDPOINT + "/themes/",
    summary="Create a new theme",
    response_model=ThemeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Themes"]
)
async def create_theme(theme: ThemeCreate):
    new_id = ThemeRepository.create_theme(**theme.dict())
    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create theme"
        )
    return ThemeRepository.get_theme_by_id(new_id)

@app.get(
    ENDPOINT + "/themes/",
    summary="Get all themes",
    response_model=List[ThemeResponse],
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_all_themes(active_only: bool = False):
    if active_only:
        themes = ThemeRepository.get_active_themes()
    else:
        themes = ThemeRepository.get_all_themes()

    if not themes:
        raise HTTPException(
            status_code=404,
            detail="No themes found"
        )
    return themes

@app.get(
    ENDPOINT + "/themes/{theme_id}/",
    summary="Get theme by ID",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_theme_by_id(theme_id: int):
    theme = ThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found"
        )
    return theme

@app.put(
    ENDPOINT + "/themes/{theme_id}/",
    summary="Update a theme",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def update_theme(theme_id: int, theme: ThemeUpdate):
    updated = ThemeRepository.update_theme(theme_id, **theme.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found or update failed"
        )
    return ThemeRepository.get_theme_by_id(theme_id)

@app.patch(
    ENDPOINT + "/themes/{theme_id}/status/",
    summary="Update theme active status",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def update_theme_status(theme_id: int, status_update: dict = Body(..., embed=True, alias="is_active")):
    # Extract the boolean value from the dict
    is_active_status = status_update.get('is_active')
    if is_active_status is None or not isinstance(is_active_status, bool):
        raise HTTPException(
            status_code=422,
            detail="Invalid 'is_active' value provided. Must be a boolean."
        )

    updated = ThemeRepository.set_theme_active_status(theme_id, is_active_status)
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found or status update failed"
        )
    return ThemeRepository.get_theme_by_id(theme_id)


@app.delete(
    ENDPOINT + "/themes/{theme_id}/",
    summary="Delete a theme",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def delete_theme(theme_id: int):
    success = ThemeRepository.delete_theme(theme_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found"
        )


@app.get(
    ENDPOINT + "/themes/{theme_id}/question_count/",
    summary="Get the number of questions for a specific theme",
    response_model=int, # This endpoint will just return an integer
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_theme_question_count(theme_id: int):
    count = QuestionRepository.get_questions_count_by_theme(theme_id)
    return count

# ----------------------------------------------------
# FastAPI Endpoints - Users
# ----------------------------------------------------

@app.post(
    ENDPOINT + "/users/",
    response_model=UserPublic, # Return the public version
    status_code=201, # Created
    summary="Create a new user",
    responses={400: {"model": ErrorMessage}},
    tags=["Users"]
)
async def create_user(user_create: UserCreate):
    # Pass the Pydantic model's data as a dictionary to the repository
    user_data = user_create.model_dump()
    user_id = UserRepository.create_user(user_data)
    if user_id is None:
        raise HTTPException(
            status_code=400,
            detail="User could not be created. Possible duplicate RFID or other issue."
        )
    
    # Fetch the newly created user to return it
    new_user = UserRepository.get_user_by_id(user_id)
    if not new_user:
        # This case should ideally not happen if create_user succeeded
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created user.")
    
    # Return UserPublic to exclude sensitive fields
    return UserPublic(**new_user)


@app.get(
    ENDPOINT + "/users/",
    response_model=List[UserPublic], # Return list of public users
    summary="Get all users",
    tags=["Users"]
)
async def get_all_users():
    users = UserRepository.get_all_users()
    return [UserPublic(**user) for user in users]


@app.get(
    ENDPOINT + "/users/{user_id}",
    response_model=UserPublic, # Return public user
    summary="Get user by ID",
    responses={404: {"model": ErrorNotFound}},
    tags=["Users"]
)
async def get_user_by_id(user_id: int):
    user = UserRepository.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return UserPublic(**user)


@app.put(
    ENDPOINT + "/users/{user_id}",
    response_model=UserPublic, # Return public user
    summary="Update an existing user by ID",
    responses={404: {"model": ErrorNotFound}, 400: {"model": ErrorMessage}},
    tags=["Users"]
)
async def update_user(user_id: int, user_update: UserUpdate):
    update_data = user_update.model_dump(exclude_unset=True) # Only include fields that were set
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    success = UserRepository.update_user(user_id, update_data)
    if not success:
        # Check if user exists before saying "not found"
        existing_user = UserRepository.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
        else:
            # This could happen if no fields were actually changed or a DB error
            raise HTTPException(status_code=400, detail="Failed to update user.")
    
    updated_user = UserRepository.get_user_by_id(user_id)
    if not updated_user:
        # Should not happen if update was successful
        raise HTTPException(status_code=500, detail="Failed to retrieve updated user.")
    
    return UserPublic(**updated_user)


@app.delete(
    ENDPOINT + "/users/{user_id}",
    status_code=204, # No Content on successful deletion
    summary="Delete a user by ID",
    responses={404: {"model": ErrorNotFound}},
    tags=["Users"]
)
async def delete_user(user_id: int):
    success = UserRepository.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return {"message": "User deleted successfully"}

# You might also add endpoints for:
# - Login (e.g., POST /api/v1/users/login with username/password, returns token/session info)
# - Logout (e.g., POST /api/v1/users/logout)
# - Get user by RFID (if needed for specific frontend flows)


# Global flag to signal the background thread to stop
stop_thread_event = Event()

# --- Raspberry Pi Script Logic (adapted into a function) ---

# Constants (re-declare or import if they were in a separate config for the Pi script)
REFRESH_INTERVAL = 1  # seconds
RFID_DISPLAY_TIME = 3  # seconds to display RFID code (matches RFID cooldown)
SERVO_IDLE_ANGLE = 0  # Neutral position when idle

def get_ip_address():
    """Get the IP address of the Raspberry Pi"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "No IP"

def format_second_row(temp, lux, angle):
    """Format the second row of the LCD with sensor data"""
    return f"{temp:.1f}C {lux:.0f}L {angle}deg"

def raspberry_pi_main_thread(stop_event: Event):
    """
    This function will run in a separate thread, containing your Raspberry Pi logic.
    It takes an Event object to signal when it should stop.
    """
    if not RPI_COMPONENTS_AVAILABLE:
        print("Skipping Raspberry Pi thread start due to component import errors.")
        return

    # Initialize components
    try:
        lcd = LCD1602A()
        rfid = HardcoreRFID()
        servo = ServoMotor()
        temp_sensor = TemperatureSensor()
        light_sensor = LightSensor()
    except Exception as e:
        print(f"Failed to initialize Raspberry Pi components in thread: {e}")
        print(traceback.format_exc())
        stop_event.set() # Signal main app about failure if critical
        return

    # Initial positions
    servo.set_angle(SERVO_IDLE_ANGLE)
    current_angle = SERVO_IDLE_ANGLE

    # State variables
    last_refresh = 0
    rfid_display_start = 0
    showing_rfid = False
    rfid_code = ""
    servo_active = False

    try:
        # Initial display setup
        lcd.clear()
        ip_address = get_ip_address()
        lcd.write_line(0, ip_address[:16])

        while not stop_event.is_set(): # Loop while stop_event is not set
            current_time = time.time()

            try:
                # Only check for RFID if we're not currently showing one and servo isn't active
                if not showing_rfid and not servo_active:
                    uid = rfid.read_card()
                    if uid:  # RFID reader already handles cooldown and duplicate detection
                        rfid_code = uid
                        rfid_display_start = current_time
                        showing_rfid = True

                        # Display RFID immediately
                        lcd.write_line(1, f"RFID:{rfid_code[:11]}")

                # Check if RFID display time has expired and start servo sweep
                if showing_rfid and not servo_active and (current_time - rfid_display_start) >= RFID_DISPLAY_TIME:
                    servo_active = True
                    try:
                        # Simple single sweep from 0 to 180 degrees in exactly 3 seconds
                        sweep_start_time = time.time()
                        sweep_duration = 3.0  # 3 seconds total
                        start_angle = 0
                        end_angle = 180

                        while (time.time() - sweep_start_time < sweep_duration) and not stop_event.is_set():
                            # Calculate current position based on time elapsed
                            elapsed = time.time() - sweep_start_time
                            progress = elapsed / sweep_duration  # 0.0 to 1.0
                            if progress > 1.0:
                                progress = 1.0

                            # Calculate angle and round to nearest 5 degrees
                            raw_angle = start_angle + (end_angle - start_angle) * progress
                            angle = round(raw_angle / 5) * 5  # Round to nearest multiple of 5

                            servo.set_angle(angle)
                            temp = temp_sensor.read_temperature()
                            lux = light_sensor()
                            current_degrees = servo.read_degrees()
                            lcd.write_line(1, format_second_row(temp, lux, current_degrees)[:16])

                            time.sleep(0.05)  # Small delay for sensor readings

                        if not stop_event.is_set(): # Only complete sweep if not stopping
                            # Ensure we end at exactly 180 degrees
                            servo.set_angle(180)
                            time.sleep(0.1)

                            # Return to idle position
                            servo.set_angle(SERVO_IDLE_ANGLE)
                            current_angle = servo.read_degrees()

                    except Exception as e:
                        print(f"Servo sweep error: {e}")
                    finally:
                        servo_active = False
                        showing_rfid = False  # Done with RFID sequence
                        lcd.clear()
                        lcd.write_line(0, ip_address[:16])
                        last_refresh = 0  # Force immediate normal display update

                # Update normal display at regular intervals (only when not showing RFID)
                if not showing_rfid and (current_time - last_refresh) >= REFRESH_INTERVAL:
                    try:
                        temp = temp_sensor.read_temperature()
                        lux = light_sensor()
                        current_angle = servo.read_degrees()
                        lcd.write_line(1, format_second_row(temp, lux, current_angle)[:16])
                        last_refresh = current_time
                    except Exception as e:
                        print(f"Sensor read error: {e}")
                        lcd.write_line(1, "Sensor Error")
                        last_refresh = current_time

                time.sleep(0.05)  # Reduced sleep for more responsive RFID detection

            except Exception as e:
                print(f"Main loop error in Pi thread: {e}")
                print(traceback.format_exc())
                time.sleep(1)

    except KeyboardInterrupt: # This won't typically be caught directly in a background thread
        print("\nExiting Pi thread due to KeyboardInterrupt (unlikely to occur directly)...")
    except Exception as e:
        print(f"Fatal error in Pi thread: {e}")
        print(traceback.format_exc())
    finally:
        print("Pi thread cleanup initiated.")
        try:
            if servo: # Check if servo was initialized
                servo.set_angle(SERVO_IDLE_ANGLE)  # Return to neutral position
                time.sleep(0.5)
                servo.cleanup()
            if lcd: # Check if lcd was initialized
                lcd.clear()
                lcd.cleanup()
            print("Pi thread cleanup complete.")
        except Exception as e:
            print(f"Pi thread cleanup error: {e}")


# --- FastAPI Application Lifecycle Events ---

@app.on_event("startup")
async def startup_event():
    print("FastAPI app starting up...")
    if RPI_COMPONENTS_AVAILABLE:
        # Start the Raspberry Pi script in a new thread
        pi_thread = Thread(target=raspberry_pi_main_thread, args=(stop_thread_event,))
        pi_thread.daemon = True # Allow main program to exit even if thread is running
        pi_thread.start()
        print("Raspberry Pi script thread started.")
    else:
        print("Raspberry Pi thread will not be started due to import errors.")


@app.on_event("shutdown")
async def shutdown_event():
    print("FastAPI app shutting down...")
    # Signal the background thread to stop
    stop_thread_event.set()
    # Give the thread a moment to clean up (optional, as it's a daemon thread)
    # If the thread is not a daemon, you'd want to join it: pi_thread.join(timeout=5)
    print("Shutdown signal sent to Raspberry Pi thread.")


# --- FastAPI Endpoints ---

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Site Quiz Backend!"}

@app.get("/api/v1/users/", response_model=List[UserPublic])
async def get_all_users(request: Request):
    """
    Fetches all users from the database.
    """
    try:
        users = UserRepository.get_all_users()
        # Your console log shows it's a list of dictionaries, so this should work.
        return [UserPublic(**user) for user in users]
    except Exception as e:
        print(f"Error in get_all_users endpoint: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to retrieve users.")

# Example of a middleware to log requests (if you still have this)
@app.middleware("http")
async def log_request(request: Request, call_next):
    # print(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    # print(f"Outgoing response status: {response.status_code}")
    return response

# ----------------------------------------------------
# Request Logging Middleware (Existing, unchanged)
# ----------------------------------------------------

@app.middleware("http")
async def log_request(request: Request, call_next):
    body = await request.body()
    print(f"\n----- INCOMING REQUEST -----")
    print(f"Method: {request.method}")
    print(f"URL: {request.url}")
    print(f"Headers: {dict(request.headers)}")
    print(f"Body: {body}")
    print(f"----------------------------\n")

    response = await call_next(request)
    return response


# ----------------------------------------------------
# Run the app (Existing, unchanged)
# ----------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:sio_app", # <-- YOU ARE RUNNING sio_app, not app directly
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"]
    )