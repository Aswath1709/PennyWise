"""
Natural Language Query API Router
Uses the ACTUAL AGENT with Gemini function calling - like original PennyWise
"""

from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel

from app.services.agent_service import get_agent_service
from app.models.schemas import NLPQueryResponse

router = APIRouter()


class QueryWithDataRequest(BaseModel):
    """Request with query and transaction data"""
    query: str
    transactions: List[dict]


@router.post("/", response_model=NLPQueryResponse)
async def process_query(request: QueryWithDataRequest):
    """
    Process a natural language query using Gemini agent with function calling.
    Just like the original PennyWise - agent picks the right tool automatically.
    """
    
    if not request.query or len(request.query.strip()) < 3:
        raise HTTPException(status_code=400, detail="Please provide a valid question")
    
    if not request.transactions:
        raise HTTPException(status_code=400, detail="No transaction data provided")
    
    # Use the REAL agent with Gemini function calling
    agent = get_agent_service()
    
    # Format transactions - ensure debit amounts are negative for expense filters
    formatted_tx = []
    for t in request.transactions:
        amount = float(t.get("amount", 0))
        tx_type = t.get("type", "")
        # Normalize: debits must be negative, credits must be positive
        if tx_type == "debit" and amount > 0:
            amount = -amount
        elif tx_type == "credit" and amount < 0:
            amount = abs(amount)
        formatted_tx.append({
            "date": t.get("date"),
            "description": t.get("description"),
            "amount": amount,
            "type": tx_type,
            "category": t.get("category_name") or t.get("category") or "other"
        })
    
    # Let the agent handle it - Gemini picks the right tool
    result = agent.ask(
        query=request.query,
        session_id="default",
        transactions=formatted_tx
    )
    
    # Get chart if generated
    visualization = None
    if result.get("charts") and len(result["charts"]) > 0:
        # Read the chart file and convert to base64
        import base64
        from pathlib import Path
        
        chart_path = result["charts"][0]
        if Path(chart_path).exists():
            with open(chart_path, "rb") as f:
                visualization = base64.b64encode(f.read()).decode("utf-8")
    
    return NLPQueryResponse(
        query=request.query,
        response=result.get("response", "I couldn't process your question."),
        data=None,  # Don't return raw data
        visualization=visualization
    )


@router.get("/suggestions")
async def get_query_suggestions():
    """Suggested questions - same as original PennyWise"""
    return {
        "suggestions": [
            "Show me a pie chart of spending by category",
            "Compare my spending between October and November 2024",
            "What are my recurring subscriptions?",
            "Find unusual transactions",
            "How much did I spend on groceries?",
            "Show me monthly spending trend",
            "What's my total spending?",
            "Compare my spending to average"
        ]
    }