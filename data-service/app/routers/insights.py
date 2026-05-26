"""
AI Insights API Router
Generates AI-powered financial insights and recommendations
"""

from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.services.gemini_service import gemini_service
from app.services.analytics_service import AnalyticsService
from app.models.schemas import InsightResponse, InsightsListResponse

router = APIRouter()


class InsightsRequest(BaseModel):
    """Request body for insights generation"""
    transactions: List[dict]


@router.post("/generate", response_model=InsightsListResponse)
async def generate_insights(request: InsightsRequest):
    """
    Generate AI-powered insights from transaction data
    
    Analyzes spending patterns, trends, and anomalies to provide
    actionable financial recommendations
    """
    
    if not request.transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")
    
    if len(request.transactions) < 5:
        raise HTTPException(
            status_code=400, 
            detail="Need at least 5 transactions to generate meaningful insights"
        )
    
    # Get analytics data
    service = AnalyticsService()
    service.load_transactions(request.transactions)
    
    spending_data = {
        "statistics": service.get_statistics(),
        "spending_by_category": service.get_spending_by_category(),
        "top_merchants": service.get_top_merchants(5),
        "anomalies": service.detect_anomalies()
    }
    
    monthly_data = service.get_monthly_spending()
    
    # Generate AI insights
    raw_insights = await gemini_service.generate_insights(spending_data, monthly_data)
    
    # Format response
    insights = [
        InsightResponse(
            insight_type=i.get("insight_type", "general"),
            title=i.get("title", "Insight"),
            insight_text=i.get("insight_text", ""),
            data=i.get("data"),
            generated_at=datetime.now()
        )
        for i in raw_insights
    ]
    
    return InsightsListResponse(insights=insights)


@router.post("/spending-alerts")
async def get_spending_alerts(request: InsightsRequest):
    """
    Get alerts for unusual spending or budget concerns
    """
    
    service = AnalyticsService()
    service.load_transactions(request.transactions)
    
    alerts = []
    
    # Check for anomalies
    anomalies = service.detect_anomalies(threshold=2.5)
    for anomaly in anomalies:
        alerts.append({
            "type": "anomaly",
            "severity": "warning",
            "title": "Unusual Transaction Detected",
            "message": f"${anomaly['amount']:.2f} at {anomaly['description']} is unusually high",
            "data": anomaly
        })
    
    # Check for high spending categories
    spending = service.get_spending_by_category()
    for cat in spending[:3]:  # Top 3 categories
        if cat['percentage'] > 40:
            alerts.append({
                "type": "high_spending",
                "severity": "info",
                "title": f"High Spending in {cat['category_name']}",
                "message": f"You've spent {cat['percentage']:.1f}% of your total spending on {cat['category_name']}",
                "data": cat
            })
    
    # Check monthly trend
    monthly = service.get_monthly_spending()
    if len(monthly) >= 2:
        latest = monthly[-1]['total_spending']
        previous = monthly[-2]['total_spending']
        
        if latest > previous * 1.3:  # 30% increase
            alerts.append({
                "type": "spending_increase",
                "severity": "warning",
                "title": "Spending Increased Significantly",
                "message": f"Your spending increased by {((latest/previous - 1) * 100):.0f}% compared to last month",
                "data": {
                    "current_month": latest,
                    "previous_month": previous
                }
            })
    
    return {"alerts": alerts}


@router.post("/savings-opportunities")
async def get_savings_opportunities(request: InsightsRequest):
    """
    Identify potential areas to save money
    """
    
    service = AnalyticsService()
    service.load_transactions(request.transactions)
    
    opportunities = []
    
    # Analyze recurring subscriptions (entertainment category)
    spending = service.get_spending_by_category()
    entertainment = next(
        (s for s in spending if s['category_name'] == 'Entertainment'), 
        None
    )
    
    if entertainment and entertainment['total_amount'] > 100:
        opportunities.append({
            "category": "Entertainment",
            "potential_savings": entertainment['total_amount'] * 0.3,
            "suggestion": "Review your subscriptions. You might be paying for services you rarely use.",
            "transactions_count": entertainment['transaction_count']
        })
    
    # Analyze food spending
    food = next(
        (s for s in spending if s['category_name'] == 'Food & Dining'), 
        None
    )
    
    if food and food['total_amount'] > 200:
        opportunities.append({
            "category": "Food & Dining",
            "potential_savings": food['total_amount'] * 0.2,
            "suggestion": "Consider meal prepping or cooking at home more often to reduce dining expenses.",
            "transactions_count": food['transaction_count']
        })
    
    # Analyze top merchants for consolidation opportunities
    top_merchants = service.get_top_merchants(5)
    shopping_merchants = [m for m in top_merchants if m['transaction_count'] > 3]
    
    if len(shopping_merchants) > 2:
        total = sum(m['total_amount'] for m in shopping_merchants)
        opportunities.append({
            "category": "Shopping Habits",
            "potential_savings": total * 0.1,
            "suggestion": "Consolidating purchases and buying in bulk could help you save on frequent shopping trips.",
            "merchants": [m['merchant'] for m in shopping_merchants]
        })
    
    return {"savings_opportunities": opportunities}
