import bcrypt
import requests
#basic required imports for fastAPI and MongoDB
from fastapi import FastAPI, Depends, HTTPException, status
from pymongo.database import Database
from fastapi.middleware.cors import CORSMiddleware 

# imports to get db set up and other user created functions
from app.database import get_db
from app.schemas import UserLogin, CarbonLogCreate, StatusUpdateSchema
from app.services.engine import CarbonEngine
from app.config import settings
from app.security import RoleChecker, create_access_token
from fastapi.security import OAuth2PasswordRequestForm

# external imports:
#PDF analyser 
from fastapi import UploadFile, File
import base64
import json
import fitz  # PyMuPDF

app = FastAPI(title="MSME Carbon Tracker Core Backend", version="1.0.0")

origins = [
    "http://localhost:5173",  # Vite local server access node
    "http://127.0.0.1:5173",  # Alternative local address mapping
]

# Inject the CORS Interceptor Middleware into your application pipeline
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # Allows your specific frontend port through the gate
    allow_credentials=True,           # Permits cookies and Authorization headers (critical for our JWTs!)
    allow_methods=["*"],              # Allows all actions (GET, POST, PATCH, OPTIONS, etc.)
    allow_headers=["*"],              # Allows any custom request header parameters passed by Axios
)

# --- BASIC AUTHENTICATION ENTRY ---

#login access for general UI use
@app.post("/api/v1/auth/login", tags=["Authentication"])
def login_user(payload: UserLogin, db: Database = Depends(get_db)):
    """
    Looks up users in MongoDB, reads their role parameter, and verifies encrypted hashes.
    """
    user = db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password credentials")
        
    # Check the encrypted password hash
    password_match = bcrypt.checkpw(payload.password.encode('utf-8'), user["password_hash"].encode('utf-8'))
    if not password_match:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password credentials")
    # [Your existing code: user lookup and password_match verification check goes here]
    
    # CRITICAL SECURITY GATEGUARD: Stop inactive accounts from generating tokens
    if not user.get("is_active", True): # Defaults to True if field doesn't exist yet
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Your account has been deactivated. Please contact your system administrator."
        )
    
    access_token = create_access_token(
        data={
            "sub": user["email"], 
            "tenant_id": str(user["tenant_id"]), 
            "role": user["role"]
        }
    )

    return {
        "message": f"Welcome back, {user['name']}!",
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "tenant_id": str(user["tenant_id"])
    }

#login access for /docs webpage
@app.post("/api/v1/auth/login-docs", include_in_schema=False)
def login_for_docs(form_data: OAuth2PasswordRequestForm = Depends(), db: Database = Depends(get_db)):
    user = db.users.find_one({"email": form_data.username.lower()})
    if not user or not bcrypt.checkpw(form_data.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token(data={"sub": user["email"], "tenant_id": str(user["tenant_id"]), "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}

# --- EMISSION CALCULATION & LEDGER ENGINE (CREATION OF NEW LOG IN DB)---
@app.post("/api/v1/logs", status_code=status.HTTP_201_CREATED, tags=["Carbon Engine"])
def create_emission_log(payload: CarbonLogCreate, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff"])) ):
    """
    Accepts raw utility usage data, looks up company region parameters, computes 
    carbon emissions, and logs the result straight to MongoDB.
    """
    # Extra security ensuring no fake id are put.
    if payload.tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Cross-tenant access violation blocked.")

    # 1. Fetch the targeted company's structural region variable to apply localized math rules
    tenant = db.tenants.find_one({"_id": payload.tenant_id})
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company profile token not found")
        
    # 2. Run the math via our calculation engine service core
    computed_tons = CarbonEngine.calculate_emissions(
        db=db,
        region=tenant["region"],
        category=payload.category,
        unit=payload.input_data.unit,
        value=payload.input_data.raw_value
    )
    
    # 3. Structure the record for storage inside the MongoDB collection
    log_document = {
        "tenant_id": payload.tenant_id,
        "facility_id": payload.facility_id,
        "billing_period": payload.billing_period,
        "scope": payload.scope,
        "category": payload.category,
        "input_data": {
            "raw_value": payload.input_data.raw_value,
            "unit": payload.input_data.unit,
            "cost": payload.input_data.cost
        },
        "calculated_emissions": {
            "co2e_metric_tons": computed_tons
        }
    }
    
    db.carbon_logs.insert_one(log_document)
    
    return {
        "status": "Success",
        "message": "Resource data tracked and metric ton values successfully written to ledger",
        "co2e_metric_tons": computed_tons
    }

# --- ANALYTICAL DASHBOARD AGGREGATOR ---
@app.get("/api/v1/analytics/dashboard", tags=["Analytics & Gamification"])
def get_dashboard_analytics(tenant_id: str, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff", "Auditor"]))):
    """
    Groups historical data by month, splits emissions into Scope 1 & 2,
    and returns contextual intensity ratios along with a letter grade.
    """

    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized dataset view request.")

    # 1. Fetch company parameters to calculate intensity ratios
    tenant = db.tenants.find_one({"_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Company profile not found")

    # 2. Query all historical logs for this company
    logs = list(db.carbon_logs.find({"tenant_id": tenant_id}))
    
    # 3. Process records into a clean timeline layout
    timeline_map = {}
    total_lifetime_emissions = 0.0

    for log in logs:
        month = log["billing_period"]  # e.g., "2026-05"
        scope = f"scope_{log['scope']}"  # e.g., "scope_1" or "scope_2"
        tons = log["calculated_emissions"]["co2e_metric_tons"]
        
        total_lifetime_emissions += tons

        if month not in timeline_map:
            timeline_map[month] = {"month": month, "scope_1": 0.0, "scope_2": 0.0}
        
        timeline_map[month][scope] = round(timeline_map[month][scope] + tons, 4)

    # Sort the timeline chronologically
    sorted_timeline = sorted(timeline_map.values(), key=lambda x: x["month"])

    # 4. Calculate Intensity Ratios using company metadata
    employees = tenant["employee_count"]
    latest_month_emissions = sorted_timeline[-1]["scope_1"] + sorted_timeline[-1]["scope_2"] if sorted_timeline else 0
    
    emissions_per_employee = round(latest_month_emissions / employees, 4) if employees > 0 else 0

    # 5. Gamification: Dynamic Grading Logic (Mock benchmark check)
    # Let's say if an employee emits less than 0.25 tons/month, they get an A. Less than 0.35 is a B, else C.
    if emissions_per_employee < 0.25:
        grade = "A"
        badge_title = "Carbon Champion"
    elif emissions_per_employee < 0.35:
        grade = "B+"
        badge_title = "Eco Efficient"
    else:
        grade = "C"
        badge_title = "Grid Heavy"

    return {
        "company_name": tenant["company_name"],
        "sustainability_grade": grade,
        "badge_title": badge_title,
        "intensity_metrics": {
            "emissions_per_employee_tons": emissions_per_employee,
            "total_lifetime_emissions_tons": round(total_lifetime_emissions, 4)
        },
        "chart_data": sorted_timeline
    }

# --- AI RECOMMANDATION SYSTEM ---
@app.get("/api/v1/advisor/recommendations", tags=["AI Recommendation System"])
def get_stored_recommendations(tenant_id: str, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff"]))):
    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized dataset view request.")
    
    stored_tasks = list(db.ai_recommendations.find({"tenant_id": tenant_id, "status": {"$ne": "Completed"}}))
    for rec in stored_tasks:
        if "_id" in rec:
            del rec["_id"]
    return {"tenant_id": tenant_id, "recommendations": stored_tasks}

@app.post("/api/v1/advisor/recommendations/generate", tags=["AI Recommendation System"])
def generate_new_ai_recommendations(tenant_id: str, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff"]))):
    """
    Reads active carbon logs, filters out already completed database tasks,
    calls GROQ to generate custom operational fixes, and SAVES them to the DB.
    """
    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized dataset view request.")

    MAX_ACTIVE_RECORDS = 10
    active_count = db.ai_recommendations.count_documents({
        "tenant_id": tenant_id,
        "status": {"$ne": "Completed"}
    })

    if active_count >= MAX_ACTIVE_RECORDS:
        # Throwing a 400 Bad Request with your specific explicit workflow guidance message
        raise HTTPException(
            status_code=400, 
            detail="You have hit your active task limit. Please complete the given tasks before generating more."
        )

    # 1. Fetch company records to build the AI's context
    tenant = db.tenants.find_one({"_id": tenant_id})
    logs = list(db.carbon_logs.find({"tenant_id": tenant_id}))
    
    if not tenant or not logs:
        raise HTTPException(status_code=404, detail="Insufficient company history to analyze")

    total_tons = sum(log["calculated_emissions"]["co2e_metric_tons"] for log in logs)
    
    # 2. CORE SYSTEM MEMORY
    existing_tasks = list(db.ai_recommendations.find({"tenant_id": tenant_id}))
    completed_titles = [task["title"] for task in existing_tasks if task["status"] == "Completed"]

    # --- FIX 1: UPDATED SYSTEM INSTRUCTION BOUNDARY RULES ---
    # Adjusted keys to match exactly what Dashboard.jsx needs (category, description, status)
    # Changed output structure to a JSON object containing a list, required for 'json_object' mode.
    system_instruction = (
        f"You are an energy auditor for the {tenant.get('industry_sector')} sector. "
        f"The company has a lifetime footprint of {total_tons} tons of CO2e. "
        f"Do NOT suggest these already implemented projects: {completed_titles}. "
        "Provide exactly 2 new operational recommendations. Return ONLY a raw JSON object with a 'recommendations' array. "
        "You MUST include metrics for monthly savings (INR), carbon reduction percentage, and upfront cost (INR). "
        "Match this exact JSON structure: "
        '{"recommendations": [{"task_key": "slug_123", "category": "Efficiency", "status": "To-Do", "title": "Title", "description": "Desc.", '
        '"estimated_monthly_savings": 4500, "estimated_carbon_reduction_pct": 4.5, "estimated_upfront_cost": 12000}]} The numbers are examples calculate accordingly and assign them.'
    )

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    groq_payload = {
        "model": settings.GROQ_API_MODEL,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": "Analyze our facility operations and generate our new tasks matrix."}
        ],
        "temperature": 0.2, 
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=groq_payload,
            timeout=10.0
        )
        response_json = response.json()
        
        # Extract the string response from Groq
        raw_ai_text = response_json["choices"][0]["message"]["content"]
        
        # --- FIX 2: PARSE THE STRING INTO A PYTHON DICTIONARY ---
        ai_data = json.loads(raw_ai_text)
        new_recommendations = ai_data.get("recommendations", [])

        # --- FIX 3: INJECT TENANT ID AND SAVE TO DATABASE ---
        # This ensures the PATCH endpoint can actually find the tasks!
        if new_recommendations:
            # 1. Enforce a strict safety ceiling (e.g., maximum 15 total tasks stored per company)

            valid_inserts = []
            for rec in new_recommendations:
                # Check if this specific task slug or title already exists in the system
                exists = db.ai_recommendations.find_one({
                    "tenant_id": tenant_id, 
                    "task_key": rec["task_key"]
                })
                if not exists:
                    rec["tenant_id"] = tenant_id
                    valid_inserts.append(rec)
            
            if valid_inserts:
                db.ai_recommendations.insert_many(valid_inserts)

        # Return the clean, mapped JSON to the frontend
        return {"message": "New optimization recommendations generated successfully."}
    except json.JSONDecodeError:
         raise HTTPException(status_code=500, detail="Failed to parse AI response into valid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Bridge Timeout: {str(e)}")

# --- AI RECOMMANDATION SYSTEM MEMORY CONTROLLER Kanban Controller ---
@app.patch("/api/v1/recommendations/{task_key}", tags=["AI Recommendation System Task specific"])
def update_recommendation_status(tenant_id: str, task_key: str, payload: StatusUpdateSchema, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff"]))):
    """
    Updates the execution state of an AI recommendation card. 
    Flipping a task to 'Completed' feeds into the AI's contextual system memory.
    """
    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized modification request.")
    
    if payload.status not in ["To-Do", "In-Progress", "Completed"]:
        raise HTTPException(status_code=400, detail="Invalid status token. Must be To-Do, In-Progress, or Completed.")
        
    result = db.ai_recommendations.update_one(
        {"tenant_id": tenant_id, "task_key": task_key},
        {"$set": {"status": payload.status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Target recommendation card task code not found.")
        
    return {"message": f"Task '{task_key}' status updated successfully to {payload.status}."}

# --- HEALTH SYSTEM MONITORS ---
@app.get("/health", tags=["System Utility"])
def system_health():
    return {"status": "online", "framework": "FastAPI", "mode": "Pure-Backend"}

# --- PDF EXTERCTOR ---
@app.post("/api/v1/logs/parse-bill", tags=["Smart Ingestion"])
async def parse_uploaded_bill(file: UploadFile = File(...), current_user: dict = Depends(RoleChecker(["Admin", "Staff"]))):
    """
    Accepts an Image or PDF utility bill. Automatically routes to Text or Vision AI
    based on the file format and contents to return a pre-fill form object.
    """
    file_bytes = await file.read()
    content_type = file.content_type
    
    extracted_text = ""
    base64_image = None

    # --- 1. SMART ROUTING LOGIC: Determine File State ---
    if content_type in ["image/jpeg", "image/png", "image/jpg"]:
        # Scenario A: It's a standard image. Encode it directly.
        base64_image = base64.b64encode(file_bytes).decode('utf-8')
        
    elif content_type == "application/pdf":
        # Scenario B: It's a PDF. Let's see if it has digital text.
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                extracted_text += page.get_text()
                
            # If the PDF has less than 50 characters, it's a scanned image posing as a PDF.
            if len(extracted_text.strip()) < 50:
                # Grab the first page, render it as an image (Pixmap), and encode it.
                first_page = doc[0]
                pix = first_page.get_pixmap()
                image_bytes = pix.tobytes("jpeg")
                base64_image = base64.b64encode(image_bytes).decode('utf-8')
                extracted_text = "" # Clear text, we are going full vision mode
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process PDF: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a PDF, JPG, or PNG.")

    # --- 2. PROMPT PREPARATION (UPGRADED) ---
    system_prompt = """
    You are an expert data-entry assistant. Extract the utility bill or payment receipt details.
    You MUST respond ONLY with a raw JSON object. Do not include markdown or conversational text.
    
    CRITICAL INSTRUCTIONS:
    1. Category Deduction: Look for contextual clues like merchant names, logos, or icons (e.g., a gas pump icon means "Petrol" or "Diesel").
    2. Estimation Fallback: If the document is a generic UPI/Payment receipt and ONLY shows the total cost (₹) but NOT the actual volume (Liters/kWh):
       - Put the total monetary amount into "cost".
       - Reverse-calculate the "raw_value". For Petrol/Diesel, assume an average Indian price of ₹107 per Liter. (e.g., if cost is ₹767, raw_value is 7.3).
       - Ensure "unit" strictly matches "Liters" or "kWh". Do NOT output "₹" as a unit.
       
    Expected JSON Schema:
    {
        "billing_period": "YYYY-MM", 
        "category": "Electricity" or "Diesel" or "Petrol",
        "input_data": {
            "raw_value": float (total consumption amount, e.g. 7.3),
            "unit": "kWh" or "Liters",
            "cost": float (total financial amount due or paid, e.g. 767)
        }
    }
    """

    # --- 3. DYNAMIC API CALL CONFIGURATION ---
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    if base64_image:
        # Route -> GROQ VISION MODEL
        groq_payload = {
            "model": settings.GROQ_API_VISION_MODEL, # llama-3.2-11b-vision-preview
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": system_prompt + "\nExtract the exact JSON data from this image."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                }
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"}
        }
    else:
        # Route -> GROQ TEXT MODEL (Cheaper & Faster for clean digital PDFs)
        groq_payload = {
            "model": settings.GROQ_API_SIMPE_MODEL, # llama-3.1-8b-instant
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract the JSON from this OCR text:\n{extracted_text}"}
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"}
        }

    # --- 4. EXECUTE ---
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=groq_payload,
            timeout=15.0
        )
        response_data = response.json()
        
        # Catch API errors (e.g., if the file was too large)
        if "error" in response_data:
            raise Exception(response_data["error"]["message"])
            
        raw_ai_text = response_data["choices"][0]["message"]["content"]
        pre_fill_object = json.loads(raw_ai_text)
        
        return {
            "status": "Success",
            "message": "File parsed successfully. Please verify the extracted data.",
            "pre_fill_data": pre_fill_object
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI failed to return valid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing Engine Error: {str(e)}")

# --- Audit View Route ---
@app.get("/api/v1/audit/ledger", tags=["Audit & Compliance"])
def get_audit_trail_ledger(tenant_id: str, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Auditor", "Staff"]))):
    """
    Returns a completely flat, transparent ledger array matching historical input metrics 
    directly to their calculation constants and official regulatory data citations.
    """

    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Access denied.")

    logs = list(db.carbon_logs.find({"tenant_id": tenant_id}))
    audit_trail = []
    
    for log in logs:
        # Cross-reference lookup inside our factors directory
        query = {"category": log["category"], "unit": log["input_data"]["unit"]}
        if log["category"] == "Electricity":
            tenant = db.tenants.find_one({"_id": tenant_id})
            query["region"] = tenant["region"] if tenant else "Universal"
            
        factor = db.emission_factors.find_one(query)
        
        audit_trail.append({
            "billing_period": log["billing_period"],
            "category": log["category"],
            "user_input_value": log["input_data"]["raw_value"],
            "unit": log["input_data"]["unit"],
            "applied_coefficient": factor["co2e_per_unit"] if factor else "N/A",
            "calculated_output_tons": log["calculated_emissions"]["co2e_metric_tons"],
            "regulatory_source_citation": factor["source"] if factor else "Standard Guideline Fallback"
        })
        
    return {"tenant_id": tenant_id, "audit_ledger": audit_trail}

# --- Simluation ---
@app.get("/api/v1/analytics/simulate", tags=["Analytics & Gamification"])
def simulate_reduction(tenant_id: str, target_month: str, reduction_pct: float, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff"]))):

    """
    Simulates a hypothetical scenario where emissions for a specific month 
    are reduced by a given percentage, returning both old and new targets.
    """

    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    # Grab logs for that specific company and month
    logs = list(db.carbon_logs.find({"tenant_id": tenant_id, "billing_period": target_month}))
    if not logs:
        raise HTTPException(status_code=404, detail="No data entries found for the selected simulation month.")
        
    original_total = sum(log["calculated_emissions"]["co2e_metric_tons"] for log in logs)
    
    # Apply simulation math matrix
    simulated_savings = original_total * (reduction_pct / 100.0)
    simulated_total = original_total - simulated_savings
    
    return {
        "billing_period": target_month,
        "original_emissions_tons": round(original_total, 4),
        "simulated_emissions_tons": round(simulated_total, 4),
        "net_carbon_saved_tons": round(simulated_savings, 4),
        "reduction_applied": f"{reduction_pct}%"
    }

# 1. READ ALL USERS (Admin Only)
@app.get("/api/v1/admin/users", tags=["User Management"])
def get_all_users(db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin"]))):
    # Fetch all users for this specific company tenant
    users = list(db.users.find({"tenant_id": current_user["tenant_id"], "email": {"$ne": current_user["email"]}}))
    for u in users:
        if "_id" in u:
            u["_id"] = str(u["_id"])
        if "password_hash" in u:
            del u["password_hash"] # Security safeguard: never leak hashes to frontend
    return users

# 2. UPDATE USER STATUS TOGGLE (Admin Only)
@app.patch("/api/v1/admin/users/{user_email}/status", tags=["User Management"])
def toggle_user_active_status(user_email: str, payload: dict, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin"]))):
    new_status = payload.get("is_active", True)
    
    result = db.users.update_one(
        {"email": user_email.lower(), "tenant_id": current_user["tenant_id"]},
        {"$set": {"is_active": new_status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Target user workspace node not found.")
        
    return {"message": f"User {user_email} status updated to {'Active' if new_status else 'Inactive'}."}

@app.post("/api/v1/admin/users", status_code=status.HTTP_201_CREATED, tags=["User Management"])
def admin_create_user(payload: dict, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin"]))):
    """
    Validates user constraints, salt-hashes incoming password parameters,
    and inserts a new active identity document attached to the admin's tenant.
    """
    email_clean = payload.get("email", "").lower().strip()
    name_raw = payload.get("name", "").strip()
    password_raw = payload.get("password", "")
    role_target = payload.get("role", "Staff")

    if not email_clean or not password_raw or not name_raw:
        raise HTTPException(status_code=400, detail="Missing required deployment identity fields.")

    # 1. Collision Check: Ensure the email isn't already claimed
    existing_user = db.users.find_one({"email": email_clean})
    if existing_user:
        raise HTTPException(status_code=400, detail="An operator account with this email anchor already exists.")

    # 2. Encrypt the incoming credentials string safely using bcrypt
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password_raw.encode('utf-8'), salt).decode('utf-8')

    # 3. Assemble the structural document layer
    new_user_document = {
        "name": name_raw,
        "email": email_clean,
        "password_hash": hashed_password,
        "role": role_target,
        "tenant_id": current_user["tenant_id"],  # Forced server-side to guarantee cross-tenant isolation
        "is_active": True                        # Automatically provisioned as active
    }

    db.users.insert_one(new_user_document)
    
    return {"status": "Success", "message": f"Account profile channels for {name_raw} securely created."}

# 3. DELETE USER ACCOUNT PROFILE (Admin Only)
@app.delete("/api/v1/admin/users/{user_email}", tags=["User Management"])
def admin_delete_user(user_email: str, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin"]))):
    """
    Locates target user identity inside the tenant boundary pool
    and safely removes it permanently from the system database.
    """
    email_clean = user_email.lower().strip()

    # Self-deletion guard: Prevent admins from locking themselves out
    if email_clean == current_user["email"].lower():
        raise HTTPException(status_code=400, detail="Administrative self-eviction blocked. You cannot delete your own active root account.")

    result = db.users.delete_one({
        "email": email_clean,
        "tenant_id": current_user["tenant_id"] # Critical cross-tenant boundary isolation check
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target user profile could not be found within your network pool.")

    return {"status": "Success", "message": f"User account {email_clean} wiped from organizational core database structures."}

@app.delete("/api/v1/logs", tags=["Carbon Engine"])
def delete_emission_log(billing_period: str, category: str, calculated_output_tons: float, tenant_id: str, db: Database = Depends(get_db), current_user: dict = Depends(RoleChecker(["Admin", "Staff"]))):
    """
    Safely finds and purges a targeted utility log matching the precise 
    metrics configuration parameters inside the tenant sandbox.
    """
    if tenant_id != str(current_user["tenant_id"]):
        raise HTTPException(status_code=403, detail="Cross-tenant mutation violation blocked.")

    # Locate and destroy the matching transaction document log entry
    result = db.carbon_logs.delete_one({
        "tenant_id": tenant_id,
        "billing_period": billing_period,
        "category": category,
        "calculated_emissions.co2e_metric_tons": calculated_output_tons
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target transaction ledger record not found.")

    return {"status": "Success", "message": "Log entry cleanly evicted from immutable database tracking grid."}