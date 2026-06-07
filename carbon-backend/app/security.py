import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pymongo.database import Database

from app.config import settings
from app.database import get_db

# This hooks into FastAPI docs, instructing it to look for 'Authorization: Bearer <token>' headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login-docs")

# --- 1. TOKEN GENERATION CORE ---
def create_access_token(data: dict) -> str:
    """
    Encrypts user claims into a secure, signed, timestamp-validated JWT string.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

# --- 2. GLOBAL AUTHENTICATION CHECK (The Security Guard) ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Database = Depends(get_db)) -> dict:
    """
    Intersects active incoming requests, decodes the JWT, verifies the signature,
    and returns the authenticated user context dictionary directly from MongoDB.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate security session token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode token using our hidden .env secret key
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        
        if email is None or tenant_id is None:
            raise credentials_exception
            
    except jwt.PyJWTError:
        raise credentials_exception

    # Pull user profile from database to ensure they are still active
    user = db.users.find_one({"email": email})
    if user is None or not user.get("is_active", True):
        raise credentials_exception
        
    return user

# --- 3. ROLE-BASED ACCESS CONTROL LAYER (RBAC Validator) ---
class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        """
        Takes an array of allowed roles (e.g., ["Admin", "Auditor"]) to gate paths.
        """
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Security Violation: Your role '{current_user['role']}' does not have permission to execute this action."
            )
        return current_user