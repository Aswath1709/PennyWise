# routers/analytics.py

"""
Analytics Router - Complete API for finance tools and agent

Endpoints:
- POST /analytics/chat - Conversational agent
- POST /analytics/summary - Quick data summary
- POST /analytics/statistics - Dashboard statistics
- POST /analytics/spending-by-category - Category breakdown
- POST /analytics/monthly-trends - Monthly income/spending
- POST /analytics/top-merchants - Top spending merchants
- POST /analytics/create-chart - Generate charts
- POST /analytics/compare-periods - Compare time periods
- POST /analytics/compare-external - Compare to benchmarks
- POST /analytics/recurring - Find subscriptions
- POST /analytics/anomalies - Detect unusual transactions
- POST /analytics/tool/{tool_name} - Execute any tool
"""

import os
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field

from app.services.analytics_service import FinanceTools, get_gemini_tools
from app.services.agent_service import get_agent_service


router = APIRouter(tags=["Analytics"])


# ========== Request/Response Models ==========

class Transaction(BaseModel):
    date: str
    description: str
    amount: float
    category: Optional[str] = "other"
    category_name: Optional[str] = None
    account_last4: Optional[str] = None
    card_type: Optional[str] = None
    bank: Optional[str] = None


class ChatRequest(BaseModel):
    query: str
    transactions: List[Transaction]
    session_id: Optional[str] = "default"


class ChatResponse(BaseModel):
    response: str
    charts: List[str] = []


class AnalyticsRequest(BaseModel):
    transactions: List[Transaction]


class ChartRequest(BaseModel):
    transactions: List[Transaction]
    chart_type: str = "pie"  # pie, bar, line
    group_by: str = "category"  # category, month, merchant
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    expenses_only: bool = True
    top_n: int = 10


class ComparePeriodRequest(BaseModel):
    transactions: List[Transaction]
    period1_start: str
    period1_end: str
    period2_start: str
    period2_end: str
    group_by: str = "category"
    create_chart: bool = True


class CompareExternalRequest(BaseModel):
    transactions: List[Transaction]
    category: str
    location: str = "USA"
    period: str = "monthly"
    household_type: str = "single"


class CompareAllExternalRequest(BaseModel):
    transactions: List[Transaction]
    location: str = "USA"
    top_n: int = 5
    household_type: str = "single"


class ToolRequest(BaseModel):
    transactions: List[Transaction]
    params: Dict = {}


def transactions_to_dicts(transactions: List[Transaction]) -> List[Dict]:
    """Convert Transaction models to dicts."""
    result = []
    for t in transactions:
        d = {
            "date": t.date,
            "description": t.description,
            "amount": t.amount,
            "category": t.category_name or t.category or "other"
        }
        if t.account_last4:
            d["account_last4"] = t.account_last4
        if t.card_type:
            d["card_type"] = t.card_type
        if t.bank:
            d["bank"] = t.bank
        result.append(d)
    return result


# ========== Agent Endpoints ==========

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Conversational chat with the finance agent.
    
    The agent can answer questions about your spending, create charts,
    compare to benchmarks, find recurring charges, detect anomalies, etc.
    
    Example queries:
    - "Show me my spending by category as a pie chart"
    - "How does my dining spending compare to average?"
    - "What are my recurring subscriptions?"
    - "Find any unusual transactions"
    - "Compare my spending this month vs last month"
    """
    try:
        agent = get_agent_service()
        transactions = transactions_to_dicts(request.transactions)
        
        result = agent.ask(
            query=request.query,
            session_id=request.session_id,
            transactions=transactions
        )
        
        return ChatResponse(
            response=result.get("response", ""),
            charts=result.get("charts", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-session/{session_id}")
async def reset_chat_session(session_id: str):
    """Reset a chat session to start fresh."""
    agent = get_agent_service()
    agent.reset_session(session_id)
    return {"status": "ok", "message": f"Session {session_id} reset"}


# ========== Quick Analysis Endpoints ==========

@router.post("/summary")
async def get_data_summary(request: AnalyticsRequest):
    """Get overview of transaction data."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.get_data_summary()


@router.post("/statistics")
async def get_statistics(request: AnalyticsRequest):
    """Get dashboard statistics (total spending, income, savings, etc.)."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.get_statistics()


@router.post("/spending-by-category")
async def get_spending_by_category(request: AnalyticsRequest):
    """Get spending breakdown by category."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return {"categories": tools.get_spending_by_category()}


@router.post("/monthly-trends")
async def get_monthly_trends(request: AnalyticsRequest):
    """Get monthly income and spending trends."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return {"monthly_trends": tools.get_monthly_spending()}


@router.post("/top-merchants")
async def get_top_merchants(request: AnalyticsRequest, limit: int = 10):
    """Get top merchants by spending."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return {"merchants": tools.get_top_merchants(limit)}


@router.post("/recurring")
async def find_recurring_charges(request: AnalyticsRequest, min_occurrences: int = 2):
    """Find recurring/subscription charges."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.find_recurring(min_occurrences)


@router.post("/anomalies")
async def detect_anomalies(request: AnalyticsRequest, threshold: float = 2.0):
    """Detect unusual transactions (statistical outliers)."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.detect_anomalies(threshold)


# ========== Chart Endpoints ==========

@router.post("/create-chart")
async def create_chart(request: ChartRequest):
    """
    Create a visual chart.
    
    chart_type: pie, bar, or line
    group_by: category, month, or merchant
    """
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.create_chart(
        chart_type=request.chart_type,
        group_by=request.group_by,
        title=request.title,
        start_date=request.start_date,
        end_date=request.end_date,
        expenses_only=request.expenses_only,
        top_n=request.top_n
    )


@router.post("/analyze-and-chart")
async def analyze_and_chart(request: ChartRequest):
    """Get data breakdown AND create a chart in one call."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.analyze_and_chart(
        chart_type=request.chart_type,
        group_by=request.group_by,
        start_date=request.start_date,
        end_date=request.end_date,
        expenses_only=request.expenses_only,
        top_n=request.top_n
    )


# ========== Comparison Endpoints ==========

@router.post("/compare-periods")
async def compare_periods(request: ComparePeriodRequest):
    """Compare spending between two time periods."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    
    if request.create_chart:
        return tools.compare_periods_chart(
            period1_start=request.period1_start,
            period1_end=request.period1_end,
            period2_start=request.period2_start,
            period2_end=request.period2_end,
            group_by=request.group_by
        )
    else:
        return tools.compare_periods(
            period1_start=request.period1_start,
            period1_end=request.period1_end,
            period2_start=request.period2_start,
            period2_end=request.period2_end,
            group_by=request.group_by
        )


@router.post("/compare-benchmark")
async def compare_to_benchmark(request: AnalyticsRequest, category: str = "all"):
    """Compare spending to static BLS benchmarks."""
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.compare_to_benchmark(category=category)


@router.post("/compare-external")
async def compare_to_external(request: CompareExternalRequest):
    """
    Compare spending to real-time external benchmarks via Google Search.
    
    This searches Google for current average spending data and compares
    to the user's actual spending.
    """
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.compare_to_external(
        category=request.category,
        location=request.location,
        period=request.period,
        household_type=request.household_type
    )


@router.post("/compare-all-external")
async def compare_all_to_external(request: CompareAllExternalRequest):
    """
    Compare all top spending categories to external benchmarks.
    
    Finds which categories you're overspending on compared to averages.
    """
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.compare_all_to_external(
        location=request.location,
        top_n=request.top_n,
        household_type=request.household_type
    )


# ========== Generic Tool Endpoint ==========

@router.post("/tool/{tool_name}")
async def execute_tool(tool_name: str, request: ToolRequest):
    """
    Execute any analytics tool by name.
    
    Available tools:
    - get_data_summary
    - query_transactions
    - aggregate
    - create_chart
    - analyze_and_chart
    - compare_periods
    - compare_periods_chart
    - compare_accounts_chart
    - find_recurring
    - detect_anomalies
    - compare_to_benchmark
    - compare_to_external
    - compare_all_to_external
    """
    tools = FinanceTools(transactions_to_dicts(request.transactions))
    return tools.execute(tool_name, request.params)


@router.get("/tools")
async def list_available_tools():
    """List all available analytics tools and their parameters."""
    tools = get_gemini_tools()
    return {"tools": [t.__name__ for t in tools]}