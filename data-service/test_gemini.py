import sys
import asyncio
import os
from unittest.mock import MagicMock

# Load env manually
from dotenv import load_dotenv
load_dotenv("/home/aswath/PennyWise/.env")

# Add app to path
sys.path.insert(0, "/home/aswath/PennyWise/data-service")

from app.services.gemini_service import gemini_service
from datetime import date

async def test():
    txs = [{
        "date": date(2023, 10, 1),
        "description": "STARBUCKS STORE 12345",
        "amount": -5.40,
        "type": "debit"
    }]
    try:
        result = await gemini_service.categorize_transactions(txs)
        print("SUCCESS:", result)
    except Exception as e:
        print("ERROR:", type(e).__name__, str(e))

if __name__ == "__main__":
    asyncio.run(test())
