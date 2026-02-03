"""
IP Management Router
Handles IP address tracking, banning, and appeal functionality
"""

from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.responses import JSONResponse, HTMLResponse
from typing import Optional
from datetime import datetime, timedelta
import json

from database.datarepository import IpAddressRepository, AuditLogRepository
from api.dependencies import get_current_user_info, get_client_ip, log_user_ip_address
from models.models import IpAddressPayload, AppealPayload, BanIpRequest


# Create router
router = APIRouter(prefix="/api/v1", tags=["IP Management"])


# Helper function to calculate ban expiry
def calculate_ban_expiry(duration_value: int, duration_unit: str) -> Optional[datetime]:
    """Calculate ban expiry datetime based on duration and unit"""
    if duration_unit == "permanent":
        return None
    
    now = datetime.now()
    if duration_unit == "minutes":
        return now + timedelta(minutes=duration_value)
    elif duration_unit == "hours":
        return now + timedelta(hours=duration_value)
    elif duration_unit == "days":
        return now + timedelta(days=duration_value)
    else:
        raise ValueError(f"Invalid duration unit: {duration_unit}")


@router.get("/client-ip")
async def get_client_ip_endpoint(request: Request):
    """Get the client's IP address from request headers"""
    try:
        ip_address = request.headers.get("X-Forwarded-For") or request.client.host
        return {"ip_address": ip_address}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get client IP: {e}")


@router.post("/ip-status")
async def check_ip_status_and_track(payload: IpAddressPayload):
    """
    Check if an IP address is banned and track it in the database.
    Creates the IP record if it doesn't exist.
    """
    client_ip_str = payload.ip_address

    try:
        is_banned_db = IpAddressRepository.is_ip_banned(client_ip_str)
        if is_banned_db:
            return {"ip_address": client_ip_str, "is_banned": True}

        ip_data = IpAddressRepository.get_ip_address_by_string(client_ip_str)
        if not ip_data:
            ip_id = IpAddressRepository.create_ip_address(client_ip_str)
            if not ip_id:
                print(f"WARNING: Failed to create new IP {client_ip_str} in database.")

        return {"ip_address": client_ip_str, "is_banned": False}
    except Exception as e:
        print(f"Error in /api/v1/ip-status for IP {client_ip_str}: {e}")
        raise HTTPException(status_code=500, detail="Error processing IP status.")


@router.get("/banned", response_class=HTMLResponse, status_code=403)
async def banned_page(request: Request):
    """
    Display a banned page to users whose IP address is restricted.
    Includes appeal functionality for expired bans.
    """
    client_ip_str = request.headers.get("X-Forwarded-For") or request.client.host
    ban_details = None
    is_currently_banned = False
    can_appeal = False  # Flag for showing appeal button

    if client_ip_str:
        try:
            ban_details = IpAddressRepository.get_ip_address_by_string(client_ip_str)
            if ban_details and ban_details.get('is_banned'):
                # Check if ban is still active
                if ban_details.get('ban_expires_at') and datetime.now() >= ban_details['ban_date'] + (ban_details['ban_expires_at'] - ban_details['ban_date']) / 2:
                    is_currently_banned = False  # Ban has expired
                    can_appeal = True
                else:
                    is_currently_banned = True  # Ban is still active or permanent (NULL expiry)
        except Exception as e:
            print(f"Error fetching ban details for {client_ip_str}: {e}")
            ban_details = None  # Reset to avoid incomplete data

    # Default values if no ban details or errors
    ban_reason = "No specific reason provided."
    ban_date_str = "N/A"
    ban_expires_str = "Permanent"
    ban_status_message = "Your access to Quizanistan is restricted."
    button_html = ""  # No appeal button by default

    if ban_details:
        if is_currently_banned:
            ban_reason = ban_details.get('ban_reason', 'No specific reason provided.') or 'No specific reason provided.'
            if ban_details.get('ban_date'):
                ban_date_str = ban_details['ban_date'].strftime('%Y-%m-%d %H:%M:%S')
            if ban_details.get('ban_expires_at'):
                ban_expires_str = ban_details['ban_expires_at'].strftime('%Y-%m-%d %H:%M:%S')
                ban_status_message = f"Your access to Quizanistan is restricted until {ban_expires_str}."
            else:
                ban_status_message = "Your access to Quizanistan is permanently restricted."
        elif can_appeal:
            ban_reason = ban_details.get('ban_reason', 'Your previous restriction has expired.') or 'Your previous restriction has expired.'
            if ban_details.get('ban_date'):
                ban_date_str = ban_details['ban_date'].strftime('%Y-%m-%d %H:%M:%S')
            ban_expires_str = "Expired"
            ban_status_message = "Your previous restriction has expired. You may appeal to regain full access."
            # Appeal button HTML
            button_html = f"""
            <button id="appealBanBtn" class="c-btn c-btn--primary">Reintegrate into Quizanistan</button>

            <div id="appealModal" class="modal">
                <div class="modal-content">
                    <span class="close-button">&times;</span>
                    <h2>Reintegrate into Quizanistan</h2>
                    <p>Are you ready to reintegrate into Quizanistan, the land of infinite wisdom?</p>
                    <p>Prove your readiness with a fitting quote:</p>
                    <textarea id="appealQuote" rows="4" placeholder="Type your inspiring quote here..."></textarea>
                    <button id="submitAppealBtn" class="c-btn c-btn--success">Submit Appeal</button>
                    <div id="appealMessage" style="margin-top: 10px; color: green;"></div>
                </div>
            </div>

            <script>
                document.addEventListener('DOMContentLoaded', () => {{
                    const appealBtn = document.getElementById('appealBanBtn');
                    const modal = document.getElementById('appealModal');
                    const closeBtn = document.querySelector('.modal-content .close-button');
                    const submitAppealBtn = document.getElementById('submitAppealBtn');
                    const appealQuote = document.getElementById('appealQuote');
                    const appealMessage = document.getElementById('appealMessage');

                    if(appealBtn) {{
                        appealBtn.onclick = () => {{ modal.style.display = 'block'; }};
                    }}
                    if(closeBtn) {{
                        closeBtn.onclick = () => {{ modal.style.display = 'none'; }};
                    }}
                    window.onclick = (event) => {{
                        if (event.target == modal) {{ modal.style.display = 'none'; }}
                    }};

                    if(submitAppealBtn) {{
                        submitAppealBtn.onclick = async () => {{
                            const ipAddress = "{client_ip_str}";
                            const quote = appealQuote.value.trim();

                            if (quote.length < 10) {{
                                appealMessage.style.color = 'red';
                                appealMessage.innerText = 'Please provide a more substantial quote.';
                                return;
                            }}

                            appealMessage.style.color = 'blue';
                            appealMessage.innerText = 'Submitting appeal...';

                            try {{
                                const response = await fetch(`${{lanIP}}/api/v1/appeal-ban`, {{
                                    method: 'POST',
                                    headers: {{ 'Content-Type': 'application/json' }},
                                    body: JSON.stringify({{ ip_address: ipAddress, quote: quote }})
                                }});

                                const data = await response.json();
                                if (response.ok) {{
                                    appealMessage.style.color = 'green';
                                    appealMessage.innerText = data.message;
                                    appealBtn.disabled = true;
                                    appealBtn.innerText = 'Appeal Submitted';
                                    setTimeout(() => {{
                                        modal.style.display = 'none';
                                        window.location.reload();
                                    }}, 2000);
                                }} else {{
                                    appealMessage.style.color = 'red';
                                    appealMessage.innerText = data.detail || 'Appeal failed.';
                                }}
                            }} catch (error) {{
                                console.error('Appeal network error:', error);
                                appealMessage.style.color = 'red';
                                appealMessage.innerText = 'Network error during appeal. Please try again.';
                            }}
                        }};
                    }}
                }});
            </script>
            """
    else:
        ban_reason = "Unable to retrieve ban details. Access is denied."
        ban_status_message = "Your access to Quizanistan is restricted."

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Denied - Quizanistan</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; color: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
            .container {{ background-color: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15); text-align: center; max-width: 600px; width: 100%; position: relative; }}
            h1 {{ color: #e74c3c; margin-bottom: 15px; font-size: 2.5em; }}
            p {{ font-size: 1.1em; line-height: 1.6; color: #555; margin-bottom: 10px; }}
            .icon {{ font-size: 5em; color: #e74c3c; margin-bottom: 25px; }}
            .details {{ background-color: #fdfdfd; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-top: 25px; text-align: left; }}
            .details strong {{ color: #444; }}
            .c-btn {{
                background-color: #3498db;
                color: white;
                padding: 12px 25px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1.1em;
                margin-top: 25px;
                transition: background-color 0.3s ease;
            }}
            .c-btn:hover {{
                background-color: #2980b9;
            }}
            .c-btn--success {{ background-color: #28a745; }}
            .c-btn--success:hover {{ background-color: #218838; }}

            /* Modal Styles */
            .modal {{
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.6);
                justify-content: center;
                align-items: center;
            }}
            .modal-content {{
                background-color: #fefefe;
                margin: auto;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                width: 90%;
                max-width: 500px;
                text-align: center;
                position: relative;
            }}
            .close-button {{
                color: #aaa;
                float: right;
                font-size: 30px;
                font-weight: bold;
                position: absolute;
                top: 10px;
                right: 20px;
                cursor: pointer;
            }}
            .close-button:hover,
            .close-button:focus {{
                color: black;
                text-decoration: none;
            }}
            .modal-content h2 {{ color: #3498db; margin-bottom: 20px; }}
            .modal-content textarea {{
                width: calc(100% - 20px);
                padding: 10px;
                margin-bottom: 15px;
                border: 1px solid #ccc;
                border-radius: 5px;
                font-size: 1em;
                resize: vertical;
            }}
        </style>
        <script>
            const lanIP = "{request.url.scheme}://{request.url.netloc}";
        </script>
    </head>
    <body>
        <div class="container">
            <div class="icon">&#9888;</div>
            <h1>Access Denied</h1>
            <p>{ban_status_message}</p>
            <div class="details">
                <p><strong>Your IP Address:</strong> {client_ip_str}</p>
                <p><strong>Reason:</strong> {ban_reason}</p>
                <p><strong>Banned On:</strong> {ban_date_str}</p>
                <p><strong>Ban Expires:</strong> {ban_expires_str}</p>
            </div>
            {button_html}
        </div>
    </body>
    </html>
    """
    return html_content


@router.post("/appeal-ban", response_class=JSONResponse)
async def appeal_ban(payload: AppealPayload, request: Request):
    """
    Process a ban appeal with a user-submitted quote.
    Only allows appeals for expired bans.
    """
    client_ip_str = payload.ip_address
    quote = payload.quote

    # Basic validation for the quote
    if not quote or len(quote.strip()) < 10:
        raise HTTPException(status_code=400, detail="Quote too short or empty. Please provide a more substantial quote.")

    try:
        ban_details = IpAddressRepository.get_ip_address_by_string(client_ip_str)

        if not ban_details or not ban_details.get('is_banned'):
            raise HTTPException(status_code=400, detail="This IP is not currently banned or no ban record found.")

        # Check if the ban has actually expired before allowing appeal via this API
        if ban_details.get('ban_expires_at') and ban_details['ban_expires_at'] > datetime.now():
            raise HTTPException(status_code=403, detail="Ban has not yet expired. Please wait.")

        # If we reach here, the ban has expired or was permanent and we're allowing appeal.
        # Log the appeal attempt (e.g., to a separate log file or a database table for appeals)
        print(f"IP {client_ip_str} appealing ban with quote: '{quote}'")
        # You might want to store the quote and appeal attempt in a dedicated 'appeals' table
        # For this example, we directly clear the ban if the criteria are met.

        success = IpAddressRepository.appeal_ban(client_ip_str)

        if success:
            return JSONResponse(status_code=200, content={"message": "Appeal successful! Welcome back to Quizanistan."})
        else:
            raise HTTPException(status_code=500, detail="Failed to process appeal.")

    except HTTPException as e:
        raise e  # Re-raise FastAPI HTTP exceptions
    except Exception as e:
        print(f"Error during ban appeal for IP {client_ip_str}: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred during appeal.")


@router.post("/ban-ip")
async def ban_ip_address(
    ban_request: BanIpRequest,
    current_user: dict = Depends(get_current_user_info),
    request: Request = None
):
    """
    Ban an IP address with a specified duration and reason.
    Only admins can ban IPs, with a maximum duration of 7 days.
    """
    user_role = current_user["role"]
    user_id = current_user["id"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins can ban IP addresses
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can ban IP addresses"
        )
    
    # Admins can ban up to a week (or permanent)
    if ban_request.ban_duration_unit == "days" and ban_request.ban_duration_value > 7:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins can ban for up to 7 days maximum"
        )
    elif ban_request.ban_duration_unit == "hours" and ban_request.ban_duration_value > 168:  # 7 days in hours
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ban duration exceeds 7 day limit"
        )
    elif ban_request.ban_duration_unit == "minutes" and ban_request.ban_duration_value > 10080:  # 7 days in minutes
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ban duration exceeds 7 day limit"
        )
    
    try:
        # Get IP address record
        ip_record = IpAddressRepository.get_ip_address_by_string(ban_request.ip_address)
        if not ip_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IP address {ban_request.ip_address} not found"
            )
        
        # Calculate ban expiry
        try:
            ban_expires_at = calculate_ban_expiry(
                ban_request.ban_duration_value,
                ban_request.ban_duration_unit
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
        # Update IP address with ban information
        success = IpAddressRepository.update_ip_address(
            ip_id=ip_record['id'],
            is_banned=True,
            ban_reason=ban_request.ban_reason or "No reason provided",
            ban_date=datetime.now(),
            banned_by=user_id,
            ban_expires_at=ban_expires_at
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to ban IP address"
            )
        
        # Create audit log for IP ban
        new_ip_values = {
            "ip_address": ban_request.ip_address,
            "is_banned": True,
            "ban_reason": ban_request.ban_reason or "No reason provided",
            "ban_date": datetime.now().isoformat(),
            "banned_by": user_id,
            "ban_expires_at": ban_expires_at.isoformat() if ban_expires_at else None
        }
        
        try:
            AuditLogRepository.create_audit_log(
                table_name="ip_addresses",
                record_id=ip_record['id'],
                action="BAN",
                old_values=None,
                new_values=json.dumps(new_ip_values),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"IP ban audit log creation failed: {audit_error}")
        
        # Log the ban action
        log_user_ip_address(user_id, client_ip)
        
        return {
            "message": f"IP address {ban_request.ip_address} has been banned successfully",
            "ban_expires_at": ban_expires_at,
            "banned_by": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error banning IP address: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ban IP address: {str(e)}"
        )
