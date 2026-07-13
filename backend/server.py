from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import bcrypt
import jwt
import aiofiles
import asyncio
import resend
from pywebpush import webpush, WebPushException
import base64
import json as json_module

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Resend email settings
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# VAPID settings for push notifications
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY')
VAPID_SUBJECT = os.environ.get('VAPID_SUBJECT', 'mailto:admin@example.com')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Health check endpoint for Kubernetes liveness/readiness probes
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Also expose health check on /api/health for consistency
@api_router.get("/health")
async def api_health_check():
    return {"status": "healthy"}

# Security
security = HTTPBearer(auto_error=False)

# Enums
class Role(str, Enum):
    SINGER = "singer"
    BASS = "bass"
    GUITARIST = "guitarist"
    KEYBOARD = "keyboard"
    DRUMMER = "drummer"
    WORSHIP_LEADER = "worship_leader"
    EVERYONE = "everyone"

class ServiceDay(str, Enum):
    SUNDAY = "Sunday"
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"

class UserRole(str, Enum):
    MASTER_ADMIN = "master_admin"
    ADMIN = "admin"
    MEMBER = "member"

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.MEMBER

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.MEMBER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole

class PasswordReset(BaseModel):
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordWithToken(BaseModel):
    token: str
    new_password: str

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None

# Team Member Models
class TeamMemberBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    roles: List[Role]
    notes: Optional[str] = None

class TeamMemberCreate(TeamMemberBase):
    pass

class TeamMember(TeamMemberBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    roles: Optional[List[Role]] = None
    notes: Optional[str] = None

# Song Models
class SongBase(BaseModel):
    title: str
    artist: Optional[str] = None
    key: Optional[str] = None
    tempo: Optional[int] = None
    notes: Optional[str] = None
    lyrics_file: Optional[str] = None  # URL to uploaded lyrics txt file
    sheet_music_file: Optional[str] = None  # URL to uploaded sheet/image file

class SongCreate(SongBase):
    pass

class Song(SongBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SongUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    key: Optional[str] = None
    tempo: Optional[int] = None
    notes: Optional[str] = None
    lyrics_file: Optional[str] = None
    sheet_music_file: Optional[str] = None

# Song Suggestion Models
class SuggestionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class SongSuggestionBase(BaseModel):
    title: str
    artist: Optional[str] = None
    youtube_link: Optional[str] = None
    notes: Optional[str] = None

class SongSuggestionCreate(SongSuggestionBase):
    pass

class SongSuggestion(SongSuggestionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    suggested_by_id: str
    suggested_by_name: str
    status: SuggestionStatus = SuggestionStatus.PENDING
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Song Slot Models
class SongSlot(BaseModel):
    song_id: str
    song_title: str
    order: int

# Service Assignment
class ServiceAssignment(BaseModel):
    member_id: str
    member_name: str
    role: Role

# Service Models
class ServiceBase(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    day: ServiceDay
    time: Optional[str] = "10:00 AM"
    title: Optional[str] = None
    notes: Optional[str] = None
    archived: Optional[bool] = False

class ServiceCreate(ServiceBase):
    pass

class Service(ServiceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignments: List[ServiceAssignment] = []
    song_slots: List[SongSlot] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceUpdate(BaseModel):
    date: Optional[str] = None
    day: Optional[ServiceDay] = None
    time: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    assignments: Optional[List[ServiceAssignment]] = None
    song_slots: Optional[List[SongSlot]] = None
    archived: Optional[bool] = None

# Swap Request Models
class SwapRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"

class SwapRequestCreate(BaseModel):
    service_id: str
    member_id: str
    role: str
    reason: str

class SwapRequestApprove(BaseModel):
    replacement_member_id: str
    replacement_member_name: str

class SwapRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_id: str
    service_date: str
    service_title: str
    member_id: str
    member_name: str
    role: str
    reason: str
    status: SwapRequestStatus = SwapRequestStatus.PENDING
    replacement_member_id: Optional[str] = None
    replacement_member_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by_id: str
    created_by_name: str
    reviewed_at: Optional[datetime] = None
    reviewed_by_id: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    denial_reason: Optional[str] = None

class SwapRequestDeny(BaseModel):
    reason: Optional[str] = None

# Member Availability Models
class MemberAvailabilityUpdate(BaseModel):
    unavailable_dates: List[str]  # List of ISO date strings YYYY-MM-DD

# Admin Task Models
class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class TaskRepeat(str, Enum):
    NONE = "none"
    WEEKLY = "weekly"

class AdminTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: str  # "everyone" or specific user_id
    assigned_to_name: str  # "Everyone" or user name
    due_date: str  # ISO date string YYYY-MM-DD
    priority: TaskPriority = TaskPriority.MEDIUM
    repeat: TaskRepeat = TaskRepeat.NONE
    repeat_day: Optional[str] = None  # Day of week for weekly tasks (monday, tuesday, etc.)

class AdminTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    assigned_to: str  # "everyone" or specific user_id
    assigned_to_name: str
    due_date: str
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    repeat: TaskRepeat = TaskRepeat.NONE
    repeat_day: Optional[str] = None  # Day of week for weekly tasks
    parent_task_id: Optional[str] = None  # ID of parent recurring task
    is_recurring_template: bool = False  # True if this is the template task
    created_by: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    completed_by: Optional[str] = None

class AdminTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    repeat: Optional[TaskRepeat] = None
    repeat_day: Optional[str] = None

# Push Notification Models
class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionData(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: Optional[str] = None

class PushSubscriptionCreate(BaseModel):
    subscription: PushSubscriptionData
    user_id: str

# Auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Update last_active timestamp
    await db.users.update_one(
        {"id": payload["user_id"]}, 
        {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )
    return user

async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        return user
    except:
        return None

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# Push notification helper functions
async def send_push_notification(subscription_info: dict, payload: dict) -> bool:
    """Send a push notification to a single subscription"""
    if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured, skipping push notification")
        return False
    
    try:
        webpush(
            subscription_info=subscription_info,
            data=json_module.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT}
        )
        return True
    except WebPushException as e:
        logger.error(f"Push notification failed: {e}")
        if e.response and e.response.status_code == 410:
            # Subscription expired, should be removed
            return False
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending push: {e}")
        return False

async def notify_user_push(user_id: str, title: str, body: str, url: str = "/", tag: str = "default"):
    """Send push notification to all subscriptions for a user"""
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    payload = {
        "title": title,
        "body": body,
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-72x72.png",
        "tag": tag,
        "url": url
    }
    
    expired_endpoints = []
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["subscription"]["endpoint"],
            "keys": sub["subscription"]["keys"]
        }
        success = await send_push_notification(subscription_info, payload)
        if not success:
            expired_endpoints.append(sub["subscription"]["endpoint"])
    
    # Clean up expired subscriptions
    if expired_endpoints:
        await db.push_subscriptions.delete_many({
            "subscription.endpoint": {"$in": expired_endpoints}
        })

async def notify_team_member_push(member_id: str, title: str, body: str, url: str = "/", tag: str = "default"):
    """Send push notification to a team member via their linked user account"""
    # Find the team member
    team_member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if not team_member or not team_member.get("email"):
        return
    
    # Find the user with matching email
    user = await db.users.find_one(
        {"email": {"$regex": f"^{team_member['email']}$", "$options": "i"}},
        {"_id": 0}
    )
    if user:
        await notify_user_push(user["id"], title, body, url, tag)

# Notification logging helper
async def log_notification(
    notification_type: str,
    sender_id: str,
    sender_name: str,
    service_id: str,
    service_title: str,
    recipients: List[dict],
    failed_recipients: List[dict] = None
):
    """Log a notification event for analytics"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "type": notification_type,  # "notify_team", "announce", "notify_member"
        "sender_id": sender_id,
        "sender_name": sender_name,
        "service_id": service_id,
        "service_title": service_title,
        "recipients": recipients,  # [{"name": "...", "email": "..."}]
        "failed_recipients": failed_recipients or [],
        "recipients_count": len(recipients),
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_logs.insert_one(log_entry)
    return log_entry

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Worship Team Database API"}

# Auth endpoints
@api_router.post("/auth/register")
async def register(input: UserCreate, current_user: dict = Depends(get_current_user)):
    # Only master_admin can create new users
    if current_user["role"] != UserRole.MASTER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Only Master Admin can create users")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": input.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": input.email.lower(),
        "name": input.name,
        "password_hash": hash_password(input.password),
        "role": input.role.value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_dict)
    
    return {
        "id": user_dict["id"],
        "email": user_dict["email"],
        "name": user_dict["name"],
        "role": user_dict["role"]
    }

@api_router.post("/auth/login")
async def login(input: UserLogin):
    user = await db.users.find_one({"email": input.email.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    # Record login activity
    login_record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "user_role": user["role"],
        "login_at": datetime.now(timezone.utc).isoformat(),
        "ip_address": None  # Can be added if needed
    }
    await db.login_history.insert_one(login_record)
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"]
    }

@api_router.post("/auth/change-password")
async def change_password(input: ChangePassword, current_user: dict = Depends(get_current_user)):
    # Verify current password
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not verify_password(input.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(input.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    new_hash = hash_password(input.new_password)
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"password_hash": new_hash}})
    return {"message": "Password changed successfully"}

# Forgot Password - Request Reset Link
@api_router.post("/auth/forgot-password")
async def forgot_password(input: ForgotPasswordRequest):
    """Send password reset email to user"""
    user = await db.users.find_one({"email": input.email.lower()}, {"_id": 0})
    
    # Always return success message to prevent email enumeration
    if not user:
        return {"message": "If an account with that email exists, a password reset link has been sent."}
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    # Generate reset token (valid for 1 hour)
    reset_token = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.password_resets.delete_many({"user_id": user["id"]})  # Remove old tokens
    await db.password_resets.insert_one({
        "token": reset_token,
        "user_id": user["id"],
        "user_email": user["email"],
        "expires_at": expiry.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get frontend URL for reset link
    frontend_url = os.environ.get("FRONTEND_URL")
    if not frontend_url:
        raise HTTPException(status_code=500, detail="Server configuration error: FRONTEND_URL not set")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Send reset email
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #1e293b; margin-bottom: 20px; font-size: 24px;">Password Reset Request</h1>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Hi {user.get('name', 'there')},
            </p>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your Worship Team account. Click the button below to set a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Reset Password
                </a>
            </div>
            
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="{reset_link}" style="color: #3b82f6; word-break: break-all;">{reset_link}</a>
            </p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    ⚠️ This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.
                </p>
            </div>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-top: 30px;">
                God bless,<br>
                <strong>Potter House Birmingham Worship Team</strong>
            </p>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated message. Please do not reply to this email.
        </p>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [user["email"]],
            "subject": "Password Reset Request - Worship Team",
            "html": html_content
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        logging.error(f"Failed to send password reset email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send reset email")
    
    return {"message": "If an account with that email exists, a password reset link has been sent."}

# Reset Password with Token
@api_router.post("/auth/reset-password")
async def reset_password_with_token(input: ResetPasswordWithToken):
    """Reset password using token from email"""
    # Find the reset token
    reset_record = await db.password_resets.find_one({"token": input.token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token has expired
    expiry = datetime.fromisoformat(reset_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        await db.password_resets.delete_one({"token": input.token})
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    
    # Validate new password
    if len(input.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update user's password
    new_hash = hash_password(input.new_password)
    result = await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete the used token
    await db.password_resets.delete_one({"token": input.token})
    
    return {"message": "Password has been reset successfully. You can now log in with your new password."}

# Verify Reset Token (for frontend validation)
@api_router.get("/auth/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    """Verify if a reset token is valid"""
    reset_record = await db.password_resets.find_one({"token": token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    
    expiry = datetime.fromisoformat(reset_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        await db.password_resets.delete_one({"token": token})
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    return {"valid": True, "email": reset_record["user_email"]}

@api_router.put("/auth/profile")
async def update_profile(input: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if input.name:
        update_data["name"] = input.name
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return user

# Push notification endpoints
@api_router.get("/push/public-key")
async def get_vapid_public_key():
    """Get the VAPID public key for push subscriptions"""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="Push notifications not configured")
    return {"public_key": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_to_push(
    subscription_data: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Subscribe to push notifications"""
    try:
        # Check if subscription already exists
        existing = await db.push_subscriptions.find_one({
            "subscription.endpoint": subscription_data.subscription.endpoint
        })
        
        if existing:
            # Update existing subscription
            await db.push_subscriptions.update_one(
                {"subscription.endpoint": subscription_data.subscription.endpoint},
                {"$set": {
                    "user_id": current_user["id"],
                    "subscription": subscription_data.subscription.model_dump(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "is_active": True
                }}
            )
        else:
            # Create new subscription
            await db.push_subscriptions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "subscription": subscription_data.subscription.model_dump(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True
            })
        
        return {"status": "subscribed", "message": "Successfully subscribed to push notifications"}
    except Exception as e:
        logger.error(f"Push subscription error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/push/unsubscribe")
async def unsubscribe_from_push(
    endpoint: str,
    current_user: dict = Depends(get_current_user)
):
    """Unsubscribe from push notifications"""
    result = await db.push_subscriptions.delete_one({
        "subscription.endpoint": endpoint,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"status": "unsubscribed", "message": "Successfully unsubscribed from push notifications"}

@api_router.get("/push/status")
async def get_push_status(current_user: dict = Depends(get_current_user)):
    """Check if user has active push subscriptions"""
    count = await db.push_subscriptions.count_documents({
        "user_id": current_user["id"],
        "is_active": True
    })
    return {"subscribed": count > 0, "subscription_count": count}

@api_router.post("/push/test")
async def test_push_notification(current_user: dict = Depends(get_current_user)):
    """Send a test push notification to the current user"""
    await notify_user_push(
        current_user["id"],
        "Test Notification",
        "Push notifications are working! 🎉",
        "/",
        "test"
    )
    return {"message": "Test notification sent"}

# Login history endpoints
@api_router.get("/login-history")
async def get_login_history(
    limit: int = 50,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get login history - only for admins"""
    history = await db.login_history.find(
        {}, 
        {"_id": 0}
    ).sort("login_at", -1).to_list(limit)
    return history

@api_router.get("/login-history/user/{user_id}")
async def get_user_login_history(
    user_id: str,
    limit: int = 20,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get login history for a specific user"""
    history = await db.login_history.find(
        {"user_id": user_id}, 
        {"_id": 0}
    ).sort("login_at", -1).to_list(limit)
    return history

@api_router.get("/login-history/stats")
async def get_login_stats(current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Get login statistics"""
    # Total logins
    total_logins = await db.login_history.count_documents({})
    
    # Logins in last 24 hours
    one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    logins_24h = await db.login_history.count_documents({"login_at": {"$gte": one_day_ago}})
    
    # Logins in last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    logins_7d = await db.login_history.count_documents({"login_at": {"$gte": seven_days_ago}})
    
    # Get unique users who logged in
    pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "last_login": {"$max": "$login_at"}, "user_name": {"$first": "$user_name"}, "user_role": {"$first": "$user_role"}}},
        {"$sort": {"count": -1}}
    ]
    user_stats = await db.login_history.aggregate(pipeline).to_list(100)
    
    return {
        "total_logins": total_logins,
        "logins_last_24h": logins_24h,
        "logins_last_7d": logins_7d,
        "users_login_count": [
            {
                "user_id": u["_id"],
                "user_name": u["user_name"],
                "user_role": u["user_role"],
                "login_count": u["count"],
                "last_login": u["last_login"]
            } for u in user_stats
        ]
    }

# User management (Master Admin only)
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/users/online")
async def get_online_users(current_user: dict = Depends(get_current_user)):
    # Users are considered online if active in the last 5 minutes
    five_minutes_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    online_users = await db.users.find(
        {"last_active": {"$gte": five_minutes_ago}},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return {
        "online_count": len(online_users),
        "users": [{"id": u["id"], "name": u["name"], "role": u["role"]} for u in online_users]
    }

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, input: UserUpdate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))):
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if "role" in update_data:
        update_data["role"] = update_data["role"].value
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))):
    # Prevent deleting self
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@api_router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, input: PasswordReset, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))):
    if len(input.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    new_hash = hash_password(input.new_password)
    result = await db.users.update_one({"id": user_id}, {"$set": {"password_hash": new_hash}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Password reset successfully"}

# Team Members CRUD (Admin+ can edit, Members can view)
@api_router.post("/team-members", response_model=TeamMember)
async def create_team_member(input: TeamMemberCreate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    member_dict = input.model_dump()
    member_obj = TeamMember(**member_dict)
    doc = member_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.team_members.insert_one(doc)
    return member_obj

@api_router.get("/team-members", response_model=List[TeamMember])
async def get_team_members(current_user: dict = Depends(get_current_user)):
    members = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    for m in members:
        if isinstance(m.get('created_at'), str):
            m['created_at'] = datetime.fromisoformat(m['created_at'])
    return members

@api_router.get("/team-members/{member_id}", response_model=TeamMember)
async def get_team_member(member_id: str, current_user: dict = Depends(get_current_user)):
    member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if isinstance(member.get('created_at'), str):
        member['created_at'] = datetime.fromisoformat(member['created_at'])
    return member

@api_router.put("/team-members/{member_id}", response_model=TeamMember)
async def update_team_member(member_id: str, input: TeamMemberUpdate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    result = await db.team_members.update_one({"id": member_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if isinstance(member.get('created_at'), str):
        member['created_at'] = datetime.fromisoformat(member['created_at'])
    return member

@api_router.delete("/team-members/{member_id}")
async def delete_team_member(member_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    result = await db.team_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"message": "Team member deleted"}

# Team Member Availability
@api_router.get("/team-members/{member_id}/availability")
async def get_member_availability(member_id: str, current_user: dict = Depends(get_current_user)):
    """Get unavailable dates for a team member"""
    member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {
        "member_id": member_id,
        "member_name": member.get("name"),
        "unavailable_dates": member.get("unavailable_dates", [])
    }

@api_router.put("/team-members/{member_id}/availability")
async def update_member_availability(
    member_id: str, 
    input: MemberAvailabilityUpdate, 
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Update unavailable dates for a team member - Admin only"""
    member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    await db.team_members.update_one(
        {"id": member_id}, 
        {"$set": {"unavailable_dates": input.unavailable_dates}}
    )
    
    return {
        "member_id": member_id,
        "member_name": member.get("name"),
        "unavailable_dates": input.unavailable_dates,
        "message": "Availability updated successfully"
    }

@api_router.get("/team-members-availability")
async def get_all_members_availability(current_user: dict = Depends(get_current_user)):
    """Get unavailable dates for all team members"""
    members = await db.team_members.find({}, {"_id": 0, "id": 1, "name": 1, "unavailable_dates": 1}).to_list(1000)
    return members

# Songs CRUD (Admin+ can edit, Members can view)
@api_router.post("/songs", response_model=Song)
async def create_song(input: SongCreate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    song_dict = input.model_dump()
    song_obj = Song(**song_dict)
    doc = song_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.songs.insert_one(doc)
    return song_obj

@api_router.get("/songs", response_model=List[Song])
async def get_songs(current_user: dict = Depends(get_current_user)):
    songs = await db.songs.find({}, {"_id": 0}).to_list(1000)
    for s in songs:
        if isinstance(s.get('created_at'), str):
            s['created_at'] = datetime.fromisoformat(s['created_at'])
    return songs

@api_router.get("/songs/{song_id}", response_model=Song)
async def get_song(song_id: str, current_user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if isinstance(song.get('created_at'), str):
        song['created_at'] = datetime.fromisoformat(song['created_at'])
    return song

@api_router.put("/songs/{song_id}", response_model=Song)
async def update_song(song_id: str, input: SongUpdate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    result = await db.songs.update_one({"id": song_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if isinstance(song.get('created_at'), str):
        song['created_at'] = datetime.fromisoformat(song['created_at'])
    return song

@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    result = await db.songs.delete_one({"id": song_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"message": "Song deleted"}

# File upload for songs
@api_router.post("/songs/{song_id}/upload")
async def upload_song_file(
    song_id: str,
    file_type: str = Form(...),  # "lyrics" or "sheet_music"
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    # Validate song exists
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Validate file type
    allowed_extensions = {
        "lyrics": [".txt"],
        "sheet_music": [".jpg", ".jpeg", ".png", ".pdf"]
    }
    
    if file_type not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Use 'lyrics' or 'sheet_music'")
    
    # Get file extension
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file_ext not in allowed_extensions[file_type]:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file extension. Allowed for {file_type}: {', '.join(allowed_extensions[file_type])}"
        )
    
    # Validate file size (max 5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    unique_filename = f"{song_id}_{file_type}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)
    
    # Update song with file URL
    file_url = f"/api/uploads/{unique_filename}"
    update_field = "lyrics_file" if file_type == "lyrics" else "sheet_music_file"
    
    await db.songs.update_one({"id": song_id}, {"$set": {update_field: file_url}})
    
    return {"message": "File uploaded successfully", "file_url": file_url}

@api_router.delete("/songs/{song_id}/file/{file_type}")
async def delete_song_file(
    song_id: str,
    file_type: str,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    if file_type not in ["lyrics", "sheet_music"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    field_name = "lyrics_file" if file_type == "lyrics" else "sheet_music_file"
    file_url = song.get(field_name)
    
    if file_url:
        # Delete the physical file
        filename = file_url.split("/")[-1]
        file_path = UPLOADS_DIR / filename
        if file_path.exists():
            file_path.unlink()
        
        # Clear the field in database
        await db.songs.update_one({"id": song_id}, {"$set": {field_name: None}})
    
    return {"message": "File deleted successfully"}

# Song Suggestions CRUD (All users can suggest, Admin+ can approve/reject)
@api_router.post("/song-suggestions", response_model=SongSuggestion)
async def create_song_suggestion(input: SongSuggestionCreate, current_user: dict = Depends(get_current_user)):
    suggestion_dict = input.model_dump()
    suggestion_obj = SongSuggestion(
        **suggestion_dict,
        suggested_by_id=current_user["id"],
        suggested_by_name=current_user["name"]
    )
    doc = suggestion_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.song_suggestions.insert_one(doc)
    return suggestion_obj

@api_router.get("/song-suggestions", response_model=List[SongSuggestion])
async def get_song_suggestions(current_user: dict = Depends(get_current_user)):
    suggestions = await db.song_suggestions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for s in suggestions:
        if isinstance(s.get('created_at'), str):
            s['created_at'] = datetime.fromisoformat(s['created_at'])
    return suggestions

@api_router.put("/song-suggestions/{suggestion_id}/approve")
async def approve_song_suggestion(suggestion_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    suggestion = await db.song_suggestions.find_one({"id": suggestion_id}, {"_id": 0})
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Update status to approved
    await db.song_suggestions.update_one({"id": suggestion_id}, {"$set": {"status": SuggestionStatus.APPROVED.value}})
    
    # Add to songs library
    new_song = Song(
        title=suggestion["title"],
        artist=suggestion.get("artist"),
        notes=suggestion.get("notes")
    )
    doc = new_song.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.songs.insert_one(doc)
    
    return {"message": "Song suggestion approved and added to library"}

@api_router.put("/song-suggestions/{suggestion_id}/reject")
async def reject_song_suggestion(suggestion_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    result = await db.song_suggestions.update_one(
        {"id": suggestion_id}, 
        {"$set": {"status": SuggestionStatus.REJECTED.value}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"message": "Song suggestion rejected"}

@api_router.put("/song-suggestions/{suggestion_id}/reset")
async def reset_song_suggestion(suggestion_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Reset an approved or rejected suggestion back to pending - Admin only"""
    suggestion = await db.song_suggestions.find_one({"id": suggestion_id}, {"_id": 0})
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    if suggestion["status"] == "pending":
        raise HTTPException(status_code=400, detail="Suggestion is already pending")
    
    await db.song_suggestions.update_one(
        {"id": suggestion_id},
        {"$set": {"status": "pending"}}
    )
    return {"message": "Song suggestion moved back to pending"}

@api_router.delete("/song-suggestions/{suggestion_id}")
async def delete_song_suggestion(suggestion_id: str, current_user: dict = Depends(get_current_user)):
    suggestion = await db.song_suggestions.find_one({"id": suggestion_id}, {"_id": 0})
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Only allow deletion by the suggester or admin
    if suggestion["suggested_by_id"] != current_user["id"] and current_user["role"] not in [UserRole.MASTER_ADMIN.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this suggestion")
    
    await db.song_suggestions.delete_one({"id": suggestion_id})
    return {"message": "Suggestion deleted"}

# Services CRUD (Admin+ can edit, Members can view)
@api_router.post("/services", response_model=Service)
async def create_service(input: ServiceCreate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    service_dict = input.model_dump()
    service_obj = Service(**service_dict)
    doc = service_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.services.insert_one(doc)
    return service_obj

@api_router.get("/services", response_model=List[Service])
async def get_services(current_user: dict = Depends(get_current_user)):
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    for s in services:
        if isinstance(s.get('created_at'), str):
            s['created_at'] = datetime.fromisoformat(s['created_at'])
    return services

@api_router.get("/services/{service_id}", response_model=Service)
async def get_service(service_id: str, current_user: dict = Depends(get_current_user)):
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if isinstance(service.get('created_at'), str):
        service['created_at'] = datetime.fromisoformat(service['created_at'])
    return service

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, input: ServiceUpdate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    # Get the current service to compare assignments
    old_service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not old_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    old_assignments = {a["member_id"]: a for a in old_service.get("assignments", [])}
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.services.update_one({"id": service_id}, {"$set": update_data})
    
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if isinstance(service.get('created_at'), str):
        service['created_at'] = datetime.fromisoformat(service['created_at'])
    
    # Check for new assignments and send push notifications
    if "assignments" in update_data:
        new_assignments = update_data["assignments"]
        service_date = service.get("date", "")
        service_title = service.get("title") or f"{service.get('day', 'Sunday')} Service"
        
        # Format date for notification
        try:
            date_obj = datetime.fromisoformat(service_date)
            formatted_date = date_obj.strftime("%B %d")
        except:
            formatted_date = service_date
        
        role_labels = {
            "worship_leader": "Worship Leader",
            "singer": "Singer",
            "bass": "Bass",
            "guitarist": "Guitarist",
            "keyboard": "Keyboard",
            "drummer": "Drummer",
            "everyone": "Everyone"
        }
        
        # Find newly assigned members
        for assignment in new_assignments:
            member_id = assignment.get("member_id")
            if member_id not in old_assignments:
                # This is a new assignment - send notification
                role = assignment.get("role", "Team Member")
                role_display = role_labels.get(role, role.replace("_", " ").title())
                
                await notify_team_member_push(
                    member_id,
                    f"You've been scheduled! 🎵",
                    f"{role_display} for {service_title} on {formatted_date}",
                    f"/services/{service_id}",
                    f"assignment-{service_id}"
                )
        
        # Check for schedule changes (date/time) and notify all assigned members
        date_changed = "date" in update_data and update_data["date"] != old_service.get("date")
        time_changed = "time" in update_data and update_data["time"] != old_service.get("time")
        
        if date_changed or time_changed:
            for assignment in service.get("assignments", []):
                member_id = assignment.get("member_id")
                change_type = "date and time" if (date_changed and time_changed) else ("date" if date_changed else "time")
                
                await notify_team_member_push(
                    member_id,
                    f"Schedule Change ⏰",
                    f"{service_title} {change_type} has been updated",
                    f"/services/{service_id}",
                    f"schedule-change-{service_id}"
                )
    
    return service

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}

# Archive/Unarchive a service
@api_router.post("/services/{service_id}/archive")
async def archive_service(service_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Toggle archive status of a service"""
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    new_archived_status = not service.get("archived", False)
    await db.services.update_one({"id": service_id}, {"$set": {"archived": new_archived_status}})
    
    return {"message": f"Service {'archived' if new_archived_status else 'unarchived'}", "archived": new_archived_status}

# Notify team members about their assignments
@api_router.post("/services/{service_id}/notify-team")
async def notify_team(service_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Send email notifications to all assigned team members for a service"""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured. Please add RESEND_API_KEY to environment.")
    
    # Get the service
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    assignments = service.get("assignments", [])
    if not assignments:
        raise HTTPException(status_code=400, detail="No team members assigned to this service")
    
    # Get all team members to find their emails
    team_members = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    member_map = {m["id"]: m for m in team_members}
    
    # Get all users to find emails
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    user_email_map = {u.get("team_member_id"): u.get("email") for u in users if u.get("team_member_id")}
    
    # Format service date
    service_date = service.get("date", "TBD")
    try:
        from datetime import datetime
        date_obj = datetime.fromisoformat(service_date)
        formatted_date = date_obj.strftime("%A, %B %d, %Y")
    except:
        formatted_date = service_date
    
    service_time = service.get("time", "TBD")
    service_title = service.get("title") or f"{service.get('day', 'Sunday')} Service"
    
    # Role display names
    role_labels = {
        "worship_leader": "Worship Leader",
        "singer": "Singer",
        "bass": "Bass",
        "guitarist": "Guitarist",
        "keyboard": "Keyboard",
        "drummer": "Drummer",
        "everyone": "Everyone"
    }
    
    emails_sent = []
    emails_failed = []
    
    # Build team list HTML
    team_list_html = ""
    for a in assignments:
        a_role = role_labels.get(a.get("role"), a.get("role", "").replace("_", " ").title())
        a_name = a.get("member_name", "Unknown")
        team_list_html += f'<p style="margin: 4px 0; color: #1e40af;">• <strong>{a_role}:</strong> {a_name}</p>'
    
    # Build song list HTML
    song_slots = service.get("song_slots", [])
    songs_list_html = ""
    if song_slots:
        for slot in sorted(song_slots, key=lambda x: x.get("order", 0)):
            song_title = slot.get("song_title", "Unknown Song")
            songs_list_html += f'<p style="margin: 4px 0; color: #065f46;">{slot.get("order", "")}. {song_title}</p>'
    else:
        songs_list_html = '<p style="margin: 4px 0; color: #6b7280; font-style: italic;">No songs added yet</p>'
    
    for assignment in assignments:
        member_id = assignment.get("member_id")
        member = member_map.get(member_id)
        if not member:
            continue
        
        member_name = member.get("name", "Team Member")
        member_email = user_email_map.get(member_id) or member.get("email")
        
        if not member_email:
            emails_failed.append({"name": member_name, "reason": "No email address"})
            continue
        
        role = assignment.get("role", "Team Member")
        role_display = role_labels.get(role, role.replace("_", " ").title())
        
        # Create HTML email content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="color: #1e293b; margin-bottom: 20px; font-size: 24px;">You've Been Scheduled! 🎵</h1>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    Hi {member_name},
                </p>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    You have been assigned to serve at an upcoming worship service. Here are the details:
                </p>
                
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Service:</strong> {service_title}</p>
                    <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Date:</strong> {formatted_date}</p>
                    <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Time:</strong> {service_time}</p>
                    <p style="margin: 0; color: #92400e;"><strong>Your Role:</strong> {role_display}</p>
                </div>
                
                <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">👥 Team</h3>
                    {team_list_html}
                </div>
                
                <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 16px;">🎶 Song List</h3>
                    {songs_list_html}
                </div>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    If you have any questions or need to request a swap, please contact the worship team admin.
                </p>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-top: 30px;">
                    God bless,<br>
                    <strong>Potter House Birmingham Worship Team</strong>
                </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
                This is an automated message from the Worship Team scheduling system.
            </p>
        </body>
        </html>
        """
        
        try:
            params = {
                "from": SENDER_EMAIL,
                "to": [member_email],
                "subject": f"You're Scheduled: {service_title} - {formatted_date}",
                "html": html_content
            }
            await asyncio.to_thread(resend.Emails.send, params)
            emails_sent.append({"name": member_name, "email": member_email})
            
            # Also send push notification
            await notify_team_member_push(
                member_id,
                f"🎵 You're Scheduled!",
                f"{role_display} for {service_title} on {formatted_date}",
                f"/service/{service_id}",
                f"schedule-{service_id}"
            )
            
            # Add small delay to avoid rate limiting
            await asyncio.sleep(0.6)
        except Exception as e:
            emails_failed.append({"name": member_name, "reason": str(e)})
    
    # Log the notification
    await log_notification(
        notification_type="notify_team",
        sender_id=current_user["id"],
        sender_name=current_user["name"],
        service_id=service_id,
        service_title=service_title,
        recipients=emails_sent,
        failed_recipients=emails_failed
    )
    
    return {
        "message": f"Notifications sent to {len(emails_sent)} team member(s)",
        "sent": emails_sent,
        "failed": emails_failed
    }

# Notify a SINGLE team member about their assignment
@api_router.post("/services/{service_id}/notify-member/{member_id}")
async def notify_single_member(service_id: str, member_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Send email notification to a single assigned team member for a service"""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured. Please add RESEND_API_KEY to environment.")
    
    # Get the service
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Find the assignment for this member
    assignments = service.get("assignments", [])
    assignment = next((a for a in assignments if a.get("member_id") == member_id), None)
    if not assignment:
        raise HTTPException(status_code=404, detail="Member not assigned to this service")
    
    # Get the team member
    team_member = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    member_name = team_member.get("name", "Team Member")
    member_email = team_member.get("email")
    
    # Also check if there's a linked user with email
    user = await db.users.find_one({"team_member_id": member_id}, {"_id": 0})
    if user and user.get("email"):
        member_email = user.get("email")
    
    if not member_email:
        raise HTTPException(status_code=400, detail=f"No email address found for {member_name}")
    
    # Format service date
    service_date = service.get("date", "TBD")
    try:
        date_obj = datetime.fromisoformat(service_date)
        formatted_date = date_obj.strftime("%A, %B %d, %Y")
    except:
        formatted_date = service_date
    
    service_time = service.get("time", "TBD")
    service_title = service.get("title") or f"{service.get('day', 'Sunday')} Service"
    
    role_labels = {
        "worship_leader": "Worship Leader",
        "singer": "Singer",
        "bass": "Bass",
        "guitarist": "Guitarist",
        "keyboard": "Keyboard",
        "drummer": "Drummer",
        "everyone": "Everyone"
    }
    
    role = assignment.get("role", "Team Member")
    role_display = role_labels.get(role, role.replace("_", " ").title())
    
    # Build team list HTML
    team_list_html = ""
    for a in assignments:
        a_role = role_labels.get(a.get("role"), a.get("role", "").replace("_", " ").title())
        a_name = a.get("member_name", "Unknown")
        is_current = a.get("member_id") == member_id
        highlight = "background-color: #fef3c7; padding: 2px 6px; border-radius: 4px;" if is_current else ""
        team_list_html += f'<p style="margin: 4px 0; color: #1e40af; {highlight}">• <strong>{a_role}:</strong> {a_name}</p>'
    
    # Build song list HTML
    song_slots = service.get("song_slots", [])
    songs_list_html = ""
    if song_slots:
        for slot in sorted(song_slots, key=lambda x: x.get("order", 0)):
            song_title = slot.get("song_title", "Unknown Song")
            songs_list_html += f'<p style="margin: 4px 0; color: #065f46;">{slot.get("order", "")}. {song_title}</p>'
    else:
        songs_list_html = '<p style="margin: 4px 0; color: #6b7280; font-style: italic;">No songs added yet</p>'
    
    # Create email content
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; padding: 20px; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #d97706; margin-bottom: 20px; font-size: 24px;">🎵 Service Reminder</h1>
            
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                Hi {member_name},
            </p>
            
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                This is a reminder about your upcoming service assignment:
            </p>
            
            <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 15px 20px; margin: 20px 0; border-radius: 8px;">
                <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">{service_title}</h2>
                <p style="margin: 5px 0; color: #78350f;"><strong>📅 Date:</strong> {formatted_date}</p>
                <p style="margin: 5px 0; color: #78350f;"><strong>⏰ Time:</strong> {service_time}</p>
                <p style="margin: 5px 0; color: #78350f;"><strong>🎤 Your Role:</strong> {role_display}</p>
            </div>
            
            <div style="margin: 25px 0;">
                <h3 style="color: #1e40af; margin-bottom: 10px; font-size: 16px;">👥 Full Team:</h3>
                {team_list_html}
            </div>
            
            <div style="margin: 25px 0;">
                <h3 style="color: #065f46; margin-bottom: 10px; font-size: 16px;">🎵 Song List:</h3>
                {songs_list_html}
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                This is an automated reminder from the Worship Team scheduling system.
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": f"Worship Team <{SENDER_EMAIL}>",
            "to": [member_email],
            "subject": f"🎵 Reminder: {service_title} - {formatted_date}",
            "html": html_content
        }
        await asyncio.to_thread(resend.Emails.send, params)
        
        # Also send push notification
        await notify_team_member_push(
            member_id,
            f"Service Reminder 🎵",
            f"You're scheduled as {role_display} for {service_title} on {formatted_date}",
            f"/services/{service_id}",
            f"reminder-{service_id}"
        )
        
        # Log the notification
        await log_notification(
            notification_type="notify_member",
            sender_id=current_user["id"],
            sender_name=current_user["name"],
            service_id=service_id,
            service_title=service_title,
            recipients=[{"name": member_name, "email": member_email}],
            failed_recipients=[]
        )
        
        return {
            "message": f"Notification sent to {member_name}",
            "email": member_email
        }
    except Exception as e:
        logger.error(f"Failed to send notification to {member_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")

@api_router.post("/services/{service_id}/notify-all")
async def notify_all_members(service_id: str, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Send email announcement to ALL team members about a service"""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured. Please add RESEND_API_KEY to environment.")
    
    # Get the service
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get ALL team members
    team_members = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    if not team_members:
        raise HTTPException(status_code=400, detail="No team members found")
    
    # Format service date
    service_date = service.get("date", "TBD")
    try:
        date_obj = datetime.fromisoformat(service_date)
        formatted_date = date_obj.strftime("%A, %B %d, %Y")
    except:
        formatted_date = service_date
    
    service_time = service.get("time", "TBD")
    service_title = service.get("title") or f"{service.get('day', 'Sunday')} Service"
    
    # Build team assignments list
    assignments = service.get("assignments", [])
    role_labels = {
        "worship_leader": "Worship Leader",
        "singer": "Singer",
        "bass": "Bass",
        "guitarist": "Guitarist",
        "keyboard": "Keyboard",
        "drummer": "Drummer",
        "everyone": "Everyone"
    }
    
    team_list_html = ""
    if assignments:
        for a in assignments:
            a_role = role_labels.get(a.get("role"), a.get("role", "").replace("_", " ").title())
            a_name = a.get("member_name", "Unknown")
            team_list_html += f'<p style="margin: 4px 0; color: #1e40af;">• <strong>{a_role}:</strong> {a_name}</p>'
    else:
        team_list_html = '<p style="margin: 4px 0; color: #6b7280; font-style: italic;">Team assignments pending</p>'
    
    # Build song list
    song_slots = service.get("song_slots", [])
    songs_list_html = ""
    if song_slots:
        for slot in sorted(song_slots, key=lambda x: x.get("order", 0)):
            song_title = slot.get("song_title", "Unknown Song")
            songs_list_html += f'<p style="margin: 4px 0; color: #065f46;">{slot.get("order", "")}. {song_title}</p>'
    else:
        songs_list_html = '<p style="margin: 4px 0; color: #6b7280; font-style: italic;">Song list pending</p>'
    
    emails_sent = []
    emails_failed = []
    
    for member in team_members:
        member_name = member.get("name", "Team Member")
        member_email = member.get("email")
        
        if not member_email:
            emails_failed.append({"name": member_name, "reason": "No email address"})
            continue
        
        # Create HTML email content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="color: #1e293b; margin-bottom: 20px; font-size: 24px;">📅 Upcoming Service Announcement</h1>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    Hi {member_name},
                </p>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    Here are the details for an upcoming worship service:
                </p>
                
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Service:</strong> {service_title}</p>
                    <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Date:</strong> {formatted_date}</p>
                    <p style="margin: 0; color: #92400e;"><strong>Time:</strong> {service_time}</p>
                </div>
                
                <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">👥 Team</h3>
                    {team_list_html}
                </div>
                
                <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 16px;">🎶 Song List</h3>
                    {songs_list_html}
                </div>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    If you have any questions, please contact the worship team admin.
                </p>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-top: 30px;">
                    God bless,<br>
                    <strong>Potter House Birmingham Worship Team</strong>
                </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
                This is an automated announcement from the Worship Team scheduling system.
            </p>
        </body>
        </html>
        """
        
        try:
            params = {
                "from": SENDER_EMAIL,
                "to": [member_email],
                "subject": f"📅 Service Announcement: {service_title} - {formatted_date}",
                "html": html_content
            }
            await asyncio.to_thread(resend.Emails.send, params)
            emails_sent.append({"name": member_name, "email": member_email})
            
            # Also send push notification to this member
            await notify_team_member_push(
                member.get("id"),
                f"📅 Service Announcement",
                f"{service_title} on {formatted_date} at {service_time}",
                f"/service/{service_id}",
                f"announce-{service_id}"
            )
            
            # Add small delay to avoid rate limiting
            await asyncio.sleep(0.6)
        except Exception as e:
            emails_failed.append({"name": member_name, "reason": str(e)})
    
    # Log the notification
    await log_notification(
        notification_type="announce",
        sender_id=current_user["id"],
        sender_name=current_user["name"],
        service_id=service_id,
        service_title=service_title,
        recipients=emails_sent,
        failed_recipients=emails_failed
    )
    
    return {
        "message": f"Announcement sent to {len(emails_sent)} team member(s)",
        "sent": emails_sent,
        "failed": emails_failed
    }

# Get upcoming services
@api_router.get("/services/upcoming/list", response_model=List[Service])
async def get_upcoming_services(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    services = await db.services.find({"date": {"$gte": today}}, {"_id": 0}).sort("date", 1).to_list(10)
    for s in services:
        if isinstance(s.get('created_at'), str):
            s['created_at'] = datetime.fromisoformat(s['created_at'])
    return services

# ============== SWAP REQUESTS ==============

@api_router.post("/swap-requests")
async def create_swap_request(
    input: SwapRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a swap request - Members can request for themselves, Admins can request for anyone"""
    # Get the service
    service = await db.services.find_one({"id": input.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get the member being swapped
    member = await db.team_members.find_one({"id": input.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    # Check if member is assigned to this service with this role
    assignment_found = False
    for assignment in service.get("assignments", []):
        if assignment.get("member_id") == input.member_id and assignment.get("role") == input.role:
            assignment_found = True
            break
    
    if not assignment_found:
        raise HTTPException(status_code=400, detail="Member is not assigned to this service with this role")
    
    # Members can only request swaps for themselves (check by matching email or linked team member)
    is_admin = current_user["role"] in [UserRole.MASTER_ADMIN.value, UserRole.ADMIN.value]
    
    if not is_admin:
        # Check if the member being swapped matches the current user (by email)
        member_email = member.get("email", "").lower() if member.get("email") else None
        user_email = current_user.get("email", "").lower()
        
        if member_email != user_email:
            raise HTTPException(status_code=403, detail="Members can only request swaps for their own assignments")
    
    # Check for existing pending swap request
    existing = await db.swap_requests.find_one({
        "service_id": input.service_id,
        "member_id": input.member_id,
        "role": input.role,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="A pending swap request already exists for this assignment")
    
    swap_request = {
        "id": str(uuid.uuid4()),
        "service_id": input.service_id,
        "service_date": service.get("date"),
        "service_title": service.get("title") or f"{service.get('day')} Service",
        "member_id": input.member_id,
        "member_name": member.get("name"),
        "role": input.role,
        "reason": input.reason,
        "status": "pending",
        "replacement_member_id": None,
        "replacement_member_name": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_id": current_user["id"],
        "created_by_name": current_user["name"],
        "reviewed_at": None,
        "reviewed_by_id": None,
        "reviewed_by_name": None,
        "denial_reason": None
    }
    
    await db.swap_requests.insert_one(swap_request)
    swap_request.pop("_id", None)
    return swap_request

@api_router.get("/swap-requests")
async def get_swap_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get all swap requests - Admin only"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.swap_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/swap-requests/my-requests")
async def get_my_swap_requests(
    current_user: dict = Depends(get_current_user)
):
    """Get swap requests created by the current user (for members to see their own requests)"""
    requests = await db.swap_requests.find(
        {"created_by_id": current_user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return requests

@api_router.get("/swap-requests/available")
async def get_available_swap_requests(
    current_user: dict = Depends(get_current_user)
):
    """Get pending swap requests that the current user can volunteer to fulfill based on their roles"""
    # Get the team member linked to this user (by email)
    user_email = current_user.get("email", "").lower()
    team_member = await db.team_members.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}}, {"_id": 0})
    
    if not team_member:
        return []
    
    user_roles = team_member.get("roles", [])
    user_member_id = team_member.get("id")
    
    if not user_roles:
        return []
    
    # Get pending swap requests where:
    # 1. The role matches one of the user's roles
    # 2. The user is not the one requesting the swap
    # 3. No volunteer has been assigned yet
    requests = await db.swap_requests.find({
        "status": "pending",
        "role": {"$in": user_roles},
        "member_id": {"$ne": user_member_id},  # Not the person being swapped out
        "volunteer_member_id": {"$exists": False}  # No volunteer yet
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return requests

@api_router.post("/swap-requests/{request_id}/volunteer")
async def volunteer_for_swap(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Volunteer to fulfill a swap request"""
    # Get the swap request
    swap_req = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    if not swap_req:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="This swap request is no longer pending")
    
    if swap_req.get("volunteer_member_id"):
        raise HTTPException(status_code=400, detail="Someone has already volunteered for this swap")
    
    # Get the team member linked to this user
    user_email = current_user.get("email", "").lower()
    team_member = await db.team_members.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}}, {"_id": 0})
    
    if not team_member:
        raise HTTPException(status_code=400, detail="You must be linked to a team member to volunteer")
    
    # Check if the user has the required role
    if swap_req["role"] not in team_member.get("roles", []):
        raise HTTPException(status_code=400, detail=f"You don't have the '{swap_req['role']}' role required for this swap")
    
    # Check user is not the one requesting the swap
    if team_member["id"] == swap_req["member_id"]:
        raise HTTPException(status_code=400, detail="You cannot volunteer for your own swap request")
    
    # Update the swap request with volunteer info
    await db.swap_requests.update_one(
        {"id": request_id},
        {"$set": {
            "volunteer_member_id": team_member["id"],
            "volunteer_member_name": team_member["name"],
            "volunteer_user_id": current_user["id"],
            "volunteered_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated_request = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    return updated_request

@api_router.delete("/swap-requests/{request_id}/volunteer")
async def withdraw_volunteer(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Withdraw volunteer offer from a swap request"""
    swap_req = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    if not swap_req:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap_req.get("volunteer_user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only withdraw your own volunteer offer")
    
    if swap_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot withdraw from a processed request")
    
    await db.swap_requests.update_one(
        {"id": request_id},
        {"$unset": {
            "volunteer_member_id": "",
            "volunteer_member_name": "",
            "volunteer_user_id": "",
            "volunteered_at": ""
        }}
    )
    
    return {"message": "Volunteer offer withdrawn"}

@api_router.get("/swap-requests/pending/count")
async def get_pending_swap_count(
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get count of pending swap requests - for notification badge"""
    count = await db.swap_requests.count_documents({"status": "pending"})
    return {"count": count}

@api_router.get("/swap-requests/{request_id}")
async def get_swap_request(
    request_id: str,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get a single swap request"""
    request = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Swap request not found")
    return request

@api_router.put("/swap-requests/{request_id}/approve")
async def approve_swap_request(
    request_id: str,
    input: SwapRequestApprove,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))
):
    """Approve a swap request with replacement - Master Admin only"""
    # Get the swap request
    swap_req = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    if not swap_req:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Swap request is not pending")
    
    # Get the service
    service = await db.services.find_one({"id": swap_req["service_id"]}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Update assignments - replace the member
    updated_assignments = []
    for assignment in service.get("assignments", []):
        if assignment.get("member_id") == swap_req["member_id"] and assignment.get("role") == swap_req["role"]:
            # Replace with the new member
            updated_assignments.append({
                "member_id": input.replacement_member_id,
                "member_name": input.replacement_member_name,
                "role": assignment["role"]
            })
        else:
            updated_assignments.append(assignment)
    
    # Update the service
    await db.services.update_one(
        {"id": swap_req["service_id"]},
        {"$set": {"assignments": updated_assignments}}
    )
    
    # Update the swap request
    await db.swap_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "replacement_member_id": input.replacement_member_id,
            "replacement_member_name": input.replacement_member_name,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by_id": current_user["id"],
            "reviewed_by_name": current_user["name"]
        }}
    )
    
    updated_request = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    return updated_request

@api_router.put("/swap-requests/{request_id}/deny")
async def deny_swap_request(
    request_id: str,
    input: SwapRequestDeny,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))
):
    """Deny a swap request - Master Admin only"""
    swap_req = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    if not swap_req:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Swap request is not pending")
    
    await db.swap_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "denied",
            "denial_reason": input.reason,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by_id": current_user["id"],
            "reviewed_by_name": current_user["name"]
        }}
    )
    
    updated_request = await db.swap_requests.find_one({"id": request_id}, {"_id": 0})
    return updated_request

@api_router.delete("/swap-requests/{request_id}")
async def delete_swap_request(
    request_id: str,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))
):
    """Delete a swap request - Master Admin only"""
    result = await db.swap_requests.delete_one({"id": request_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Swap request not found")
    return {"message": "Swap request deleted"}

# Stats endpoint
@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    team_count = await db.team_members.count_documents({})
    song_count = await db.songs.count_documents({})
    service_count = await db.services.count_documents({})
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    upcoming_count = await db.services.count_documents({"date": {"$gte": today}})
    return {
        "team_members": team_count,
        "songs": song_count,
        "total_services": service_count,
        "upcoming_services": upcoming_count
    }

# App Settings endpoints
class AppSettingsUpdate(BaseModel):
    app_title: Optional[str] = None
    app_subtitle: Optional[str] = None

@api_router.get("/settings/app")
async def get_app_settings(current_user: dict = Depends(get_current_user_optional)):
    """Get app settings - accessible to anyone (even unauthenticated for login page)"""
    settings = await db.app_settings.find_one({"id": "app_settings"}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "app_title": "Potter House Birmingham",
            "app_subtitle": "Worship Team"
        }
    return {
        "app_title": settings.get("app_title", "Potter House Birmingham"),
        "app_subtitle": settings.get("app_subtitle", "Worship Team")
    }

@api_router.put("/settings/app")
async def update_app_settings(input: AppSettingsUpdate, current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Update app settings - only admins can update"""
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Upsert the settings
    await db.app_settings.update_one(
        {"id": "app_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    # Return updated settings
    settings = await db.app_settings.find_one({"id": "app_settings"}, {"_id": 0})
    return {
        "app_title": settings.get("app_title", "Potter House Birmingham"),
        "app_subtitle": settings.get("app_subtitle", "Worship Team")
    }

# Admin Tasks endpoints (Master Admin only for create/update/delete)
@api_router.get("/admin-tasks")
async def get_admin_tasks(current_user: dict = Depends(get_current_user)):
    """Get admin tasks - admins see their own tasks, master admin sees all"""
    if current_user["role"] == UserRole.MASTER_ADMIN.value:
        # Master admin sees all tasks
        tasks = await db.admin_tasks.find({}, {"_id": 0}).sort("due_date", 1).to_list(100)
    else:
        # Admins see tasks assigned to them or "everyone"
        tasks = await db.admin_tasks.find(
            {"$or": [
                {"assigned_to": current_user["id"]},
                {"assigned_to": "everyone"}
            ]},
            {"_id": 0}
        ).sort("due_date", 1).to_list(100)
    return tasks

@api_router.post("/admin-tasks", response_model=AdminTask)
async def create_admin_task(
    task: AdminTaskCreate,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))
):
    """Create a new admin task (Master Admin only)"""
    # Determine repeat_day from due_date if weekly repeat
    repeat_day = task.repeat_day
    if task.repeat == TaskRepeat.WEEKLY and not repeat_day:
        try:
            due_date_obj = datetime.fromisoformat(task.due_date)
            repeat_day = due_date_obj.strftime("%A").lower()
        except:
            repeat_day = None
    
    new_task = AdminTask(
        title=task.title,
        description=task.description,
        assigned_to=task.assigned_to,
        assigned_to_name=task.assigned_to_name,
        due_date=task.due_date,
        priority=task.priority,
        repeat=task.repeat,
        repeat_day=repeat_day,
        is_recurring_template=task.repeat == TaskRepeat.WEEKLY,
        created_by=current_user["id"],
        created_by_name=current_user["name"]
    )
    await db.admin_tasks.insert_one(new_task.model_dump())
    
    # Send notification to assigned user(s)
    if task.assigned_to == "everyone":
        # Notify all admins
        admins = await db.users.find(
            {"role": {"$in": [UserRole.ADMIN.value, UserRole.MASTER_ADMIN.value]}},
            {"_id": 0}
        ).to_list(100)
        for admin in admins:
            await notify_user_push(
                admin["id"],
                "📋 New Task Assigned",
                f"{task.title} - Due: {task.due_date}",
                "/admin-tasks",
                f"task-{new_task.id}"
            )
    else:
        # Notify specific user
        await notify_user_push(
            task.assigned_to,
            "📋 New Task Assigned",
            f"{task.title} - Due: {task.due_date}",
            "/admin-tasks",
            f"task-{new_task.id}"
        )
    
    return new_task

# Helper function to generate next weekly task
async def generate_next_weekly_task(template_task: dict):
    """Generate the next instance of a weekly recurring task"""
    try:
        current_due = datetime.fromisoformat(template_task["due_date"])
        next_due = current_due + timedelta(days=7)
        
        new_task = {
            "id": str(uuid.uuid4()),
            "title": template_task["title"],
            "description": template_task.get("description"),
            "assigned_to": template_task["assigned_to"],
            "assigned_to_name": template_task["assigned_to_name"],
            "due_date": next_due.strftime("%Y-%m-%d"),
            "priority": template_task["priority"],
            "status": TaskStatus.PENDING.value,
            "repeat": TaskRepeat.WEEKLY.value,
            "repeat_day": template_task.get("repeat_day"),
            "parent_task_id": template_task.get("parent_task_id") or template_task["id"],
            "is_recurring_template": False,
            "created_by": template_task["created_by"],
            "created_by_name": template_task["created_by_name"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "completed_by": None
        }
        await db.admin_tasks.insert_one(new_task)
        return new_task
    except Exception as e:
        logger.error(f"Failed to generate weekly task: {e}")
        return None

@api_router.get("/admin-tasks/{task_id}")
async def get_admin_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific admin task"""
    task = await db.admin_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permission
    if current_user["role"] != UserRole.MASTER_ADMIN.value:
        if task["assigned_to"] != current_user["id"] and task["assigned_to"] != "everyone":
            raise HTTPException(status_code=403, detail="Not authorized to view this task")
    
    return task

@api_router.put("/admin-tasks/{task_id}")
async def update_admin_task(
    task_id: str,
    update: AdminTaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an admin task - Master Admin can update all fields, others can only update status"""
    task = await db.admin_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if current_user["role"] != UserRole.MASTER_ADMIN.value:
        # Non-master admins can only update status
        if task["assigned_to"] != current_user["id"] and task["assigned_to"] != "everyone":
            raise HTTPException(status_code=403, detail="Not authorized to update this task")
        # Only allow status update
        update_data = {"status": update.status} if update.status else {}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # If marking as completed, record who and when
    if update_data.get("status") == TaskStatus.COMPLETED.value:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        update_data["completed_by"] = current_user["name"]
        
        # If this is a weekly recurring task, create the next occurrence
        if task.get("repeat") == TaskRepeat.WEEKLY.value:
            await generate_next_weekly_task(task)
    
    await db.admin_tasks.update_one({"id": task_id}, {"$set": update_data})
    updated_task = await db.admin_tasks.find_one({"id": task_id}, {"_id": 0})
    return updated_task

@api_router.delete("/admin-tasks/{task_id}")
async def delete_admin_task(
    task_id: str,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN]))
):
    """Delete an admin task (Master Admin only)"""
    result = await db.admin_tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

@api_router.get("/admin-tasks/stats/summary")
async def get_admin_tasks_stats(current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    """Get admin task statistics"""
    if current_user["role"] == UserRole.MASTER_ADMIN.value:
        tasks = await db.admin_tasks.find({}, {"_id": 0}).to_list(1000)
    else:
        tasks = await db.admin_tasks.find(
            {"$or": [{"assigned_to": current_user["id"]}, {"assigned_to": "everyone"}]},
            {"_id": 0}
        ).to_list(1000)
    
    pending = len([t for t in tasks if t.get("status") == "pending"])
    in_progress = len([t for t in tasks if t.get("status") == "in_progress"])
    completed = len([t for t in tasks if t.get("status") == "completed"])
    
    # Overdue tasks
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue = len([t for t in tasks if t.get("due_date", "") < today and t.get("status") != "completed"])
    
    return {
        "total": len(tasks),
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "overdue": overdue
    }

# Notification logs endpoints
@api_router.get("/analytics/notifications")
async def get_notification_logs(
    limit: int = 50,
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get notification history for analytics"""
    logs = await db.notification_logs.find(
        {},
        {"_id": 0}
    ).sort("sent_at", -1).to_list(limit)
    return logs

@api_router.get("/analytics/notifications/stats")
async def get_notification_stats(
    current_user: dict = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Get notification statistics"""
    # Get all logs
    logs = await db.notification_logs.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    total_notifications = len(logs)
    total_recipients = sum(log.get("recipients_count", 0) for log in logs)
    
    # Count by type
    by_type = {}
    for log in logs:
        ntype = log.get("type", "unknown")
        if ntype not in by_type:
            by_type[ntype] = 0
        by_type[ntype] += 1
    
    # Count by sender
    by_sender = {}
    for log in logs:
        sender = log.get("sender_name", "Unknown")
        if sender not in by_sender:
            by_sender[sender] = 0
        by_sender[sender] += 1
    
    # Get recent activity (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_logs = [log for log in logs if log.get("sent_at", "") >= seven_days_ago]
    
    return {
        "total_notifications": total_notifications,
        "total_recipients": total_recipients,
        "by_type": by_type,
        "by_sender": by_sender,
        "last_7_days": len(recent_logs)
    }

# Analytics endpoints
@api_router.get("/analytics/songs")
async def get_song_analytics(current_user: dict = Depends(get_current_user)):
    """Get song usage statistics"""
    # Get all songs
    songs = await db.songs.find({}, {"_id": 0}).to_list(1000)
    # Get all services
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    
    # Count song usage
    song_usage = {}
    for song in songs:
        song_usage[song["id"]] = {
            "id": song["id"],
            "title": song["title"],
            "artist": song.get("artist", ""),
            "usage_count": 0,
            "last_used": None,
            "services": []
        }
    
    for service in services:
        for slot in service.get("song_slots", []):
            song_id = slot.get("song_id")
            if song_id and song_id in song_usage:
                song_usage[song_id]["usage_count"] += 1
                service_date = service.get("date")
                song_usage[song_id]["services"].append({
                    "date": service_date,
                    "day": service.get("day"),
                    "time": service.get("time")
                })
                # Track last used
                if song_usage[song_id]["last_used"] is None or service_date > song_usage[song_id]["last_used"]:
                    song_usage[song_id]["last_used"] = service_date
    
    # Convert to list and sort by usage count (most used first)
    result = list(song_usage.values())
    result.sort(key=lambda x: x["usage_count"], reverse=True)
    
    return result

@api_router.get("/analytics/team-members")
async def get_team_member_analytics(current_user: dict = Depends(get_current_user)):
    """Get team member assignment statistics"""
    # Get all team members
    members = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    # Get all services
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    
    # Count member assignments
    member_stats = {}
    for member in members:
        member_stats[member["id"]] = {
            "id": member["id"],
            "name": member["name"],
            "roles": member.get("roles", []),
            "assignment_count": 0,
            "last_assigned": None,
            "role_breakdown": {},
            "services": []
        }
    
    for service in services:
        for assignment in service.get("assignments", []):
            member_id = assignment.get("member_id")
            if member_id and member_id in member_stats:
                member_stats[member_id]["assignment_count"] += 1
                role = assignment.get("role", "unknown")
                
                # Track role breakdown
                if role not in member_stats[member_id]["role_breakdown"]:
                    member_stats[member_id]["role_breakdown"][role] = 0
                member_stats[member_id]["role_breakdown"][role] += 1
                
                service_date = service.get("date")
                member_stats[member_id]["services"].append({
                    "date": service_date,
                    "day": service.get("day"),
                    "time": service.get("time"),
                    "role": role
                })
                
                # Track last assigned
                if member_stats[member_id]["last_assigned"] is None or service_date > member_stats[member_id]["last_assigned"]:
                    member_stats[member_id]["last_assigned"] = service_date
    
    # Convert to list and sort by assignment count (most assigned first)
    result = list(member_stats.values())
    result.sort(key=lambda x: x["assignment_count"], reverse=True)
    
    return result

@api_router.get("/analytics/summary")
async def get_analytics_summary(current_user: dict = Depends(get_current_user)):
    """Get overall analytics summary"""
    total_services = await db.services.count_documents({})
    total_songs = await db.songs.count_documents({})
    total_members = await db.team_members.count_documents({})
    
    # Get all services to calculate totals
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    
    total_song_slots = 0
    total_assignments = 0
    
    for service in services:
        total_song_slots += len(service.get("song_slots", []))
        total_assignments += len(service.get("assignments", []))
    
    return {
        "total_services": total_services,
        "total_songs": total_songs,
        "total_members": total_members,
        "total_song_uses": total_song_slots,
        "total_assignments": total_assignments,
        "avg_songs_per_service": round(total_song_slots / total_services, 1) if total_services > 0 else 0,
        "avg_members_per_service": round(total_assignments / total_services, 1) if total_services > 0 else 0
    }

# Initialize master admin on startup
@app.on_event("startup")
async def init_master_admin():
    master_email = os.environ.get('MASTER_ADMIN_EMAIL')
    master_password = os.environ.get('MASTER_ADMIN_PASSWORD')
    master_name = os.environ.get('MASTER_ADMIN_NAME', 'Master Admin')
    
    # Skip if environment variables not set (will use existing admin or manual setup)
    if not master_email or not master_password:
        print("MASTER_ADMIN_EMAIL or MASTER_ADMIN_PASSWORD not set, skipping auto-creation")
        return
    
    existing = await db.users.find_one({"email": master_email})
    if not existing:
        master_user = {
            "id": str(uuid.uuid4()),
            "email": master_email,
            "name": master_name,
            "password_hash": hash_password(master_password),
            "role": UserRole.MASTER_ADMIN.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(master_user)
        print(f"Master admin created: {master_email}")

# Include the router in the main app
app.include_router(api_router)

# Mount static files for uploads
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


