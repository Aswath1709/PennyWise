"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


# ============ Transaction Schemas ============

class TransactionBase(BaseModel):
    """Base transaction schema"""
    date: date
    description: str
    amount: Decimal
    type: str = Field(..., pattern="^(debit|credit)$")


class TransactionCreate(TransactionBase):
    """Schema for creating a transaction"""
    category_id: Optional[int] = None
    raw_description: Optional[str] = None


class TransactionResponse(TransactionBase):
    """Schema for transaction response"""
    id: int
    user_id: int
    category_id: Optional[int]
    category_name: Optional[str] = None
    ai_categorized: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ParsedTransaction(BaseModel):
    """Schema for a parsed transaction from PDF"""
    date: date
    description: str
    amount: float
    type: str
    raw_description: str


# ============ PDF Parsing Schemas ============

class PDFParseResponse(BaseModel):
    """Response from PDF parsing"""
    success: bool
    message: str
    bank_name: str = "Chase"
    statement_start_date: Optional[date] = None
    statement_end_date: Optional[date] = None
    transactions_count: int = 0
    transactions: List[ParsedTransaction] = []


# ============ Categorization Schemas ============

class CategoryResponse(BaseModel):
    """Category response"""
    id: int
    name: str
    icon: Optional[str]
    color: Optional[str]


class CategorizationRequest(BaseModel):
    """Request to categorize transactions"""
    transactions: List[ParsedTransaction]


class CategorizedTransaction(BaseModel):
    """Transaction with AI-assigned category"""
    date: date
    description: str
    amount: float
    type: str
    category_id: int
    category_name: str
    confidence: float = Field(..., ge=0, le=1)


class CategorizationResponse(BaseModel):
    """Response from AI categorization"""
    success: bool
    categorized_transactions: List[CategorizedTransaction]


# ============ Analytics Schemas ============

class SpendingByCategory(BaseModel):
    """Spending breakdown by category"""
    category_id: int
    category_name: str
    total_amount: float
    transaction_count: int
    percentage: float


class MonthlySpending(BaseModel):
    """Monthly spending summary"""
    month: str
    total_spending: float
    total_income: float
    net: float


class AnalyticsResponse(BaseModel):
    """Analytics data response"""
    total_spending: float
    total_income: float
    spending_by_category: List[SpendingByCategory]
    monthly_trend: List[MonthlySpending]
    top_merchants: List[dict]


# ============ Budget Schemas ============

class BudgetCreate(BaseModel):
    """Create a budget"""
    category_id: int
    amount: Decimal
    period: str = Field(..., pattern="^(weekly|monthly|yearly)$")
    alert_threshold: float = 80.0


class BudgetResponse(BaseModel):
    """Budget with spending progress"""
    id: int
    category_id: int
    category_name: str
    budget_amount: float
    spent_amount: float
    remaining: float
    percentage_used: float
    period: str
    is_over_budget: bool
    alert_triggered: bool


class BudgetAlertResponse(BaseModel):
    """Budget alert notification"""
    budget_id: int
    category_name: str
    message: str
    percentage_used: float
    severity: str = Field(..., pattern="^(warning|critical|over)$")


# ============ Insights Schemas ============

class InsightResponse(BaseModel):
    """AI-generated insight"""
    insight_type: str
    title: str
    insight_text: str
    data: Optional[dict] = None
    generated_at: datetime


class InsightsListResponse(BaseModel):
    """List of insights"""
    insights: List[InsightResponse]


# ============ NLP Query Schemas ============

class NLPQueryRequest(BaseModel):
    """Natural language query request"""
    query: str = Field(..., min_length=3, max_length=500)


class NLPQueryResponse(BaseModel):
    """Response to natural language query"""
    query: str
    response: str
    data: Optional[dict] = None
    visualization: Optional[str] = None  # base64 chart image
