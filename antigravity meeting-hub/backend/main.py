from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import uuid
from datetime import datetime
from processor import MeetingProcessor
import database

database.init_db()

app = FastAPI(title="Meeting Intelligence Hub API")

# Setup CORS for the Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global storage for the latest processor (for chat)
current_processor = None
PENDING_OTPS = {} # Store OTPs in memory for simplicity {email: otp}

class User(BaseModel):
    name: str
    email: str
    password: str

class OTPVerifyRequest(BaseModel):
    name: str
    email: str
    password: str
    otp: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    query: str

@app.post("/request-otp")
async def request_otp(email: str):
    # In a real app, send this via email. For now, we'll return it or log it.
    otp = str(uuid.uuid4().int)[:6]
    PENDING_OTPS[email] = otp
    print(f"DEBUG: OTP for {email} is {otp}")
    return {"status": "success", "message": "OTP sent to email (Check console for mock OTP)"}

@app.post("/register")
async def register(req: OTPVerifyRequest):
    if req.email not in PENDING_OTPS or PENDING_OTPS[req.email] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    success = database.add_user(req.name, req.email, req.password)
    if not success:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    del PENDING_OTPS[req.email]
    return {"status": "success", "message": "User registered successfully"}

@app.post("/login")
async def login(req: LoginRequest):
    user = database.get_user(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Email. No account found with this address.")
    
    if user["password"] == req.password:
        return {"status": "success", "user": {"name": user["name"], "email": user["email"]}}
    else:
        raise HTTPException(status_code=401, detail="Invalid Password. Please try again.")

@app.post("/upload")
async def upload_transcript(email: str = "guest", file: UploadFile = File(...)):
    global current_processor
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".txt", ".vtt"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .txt or .vtt file.")

    try:
        content = await file.read()
        text = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    processor = MeetingProcessor(text, file.filename)
    current_processor = processor
    
    analysis = {
        "id": str(uuid.uuid4()),
        "user_email": email,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "basic_info": processor.get_basic_info(),
        "overview": processor.generate_overview(),
        "decisions": processor.extract_decisions(),
        "action_items": processor.extract_action_items(),
        "sentiment": processor.analyze_sentiment()
    }

    # Save to archive
    database.add_meeting(analysis)
    
    return analysis

@app.get("/archive/{email}")
async def get_archive(email: str):
    user_meetings = database.get_user_meetings(email)
    return user_meetings

@app.post("/chat")
async def chat_with_transcript(req: ChatRequest):
    global current_processor
    if not current_processor:
        raise HTTPException(status_code=400, detail="No transcript has been uploaded yet.")
    return current_processor.chat_query(req.query)

@app.get("/")
def read_root():
    return {"message": "Meeting Intelligence Hub API is active"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
