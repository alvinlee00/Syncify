#!/usr/bin/env python3
"""
Syncify Python Application Runner
"""
import uvicorn
import os
from dotenv import load_dotenv

if __name__ == "__main__":
    load_dotenv()

    port = int(os.getenv("PORT", 3000))

    print(f"Starting Syncify Python backend on http://127.0.0.1:{port}")
    print("Make sure to install dependencies: pip install -r requirements.txt")
    print("Configure your .env file with API credentials before running")

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        log_level="info"
    )