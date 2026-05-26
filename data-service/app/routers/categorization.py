"""
Categorization API Router
Handles AI-powered transaction categorization
"""

from fastapi import APIRouter, HTTPException
from typing import List

from app.services.gemini_service import gemini_service, DEFAULT_CATEGORIES
from app.models.schemas import (
    ParsedTransaction, 
    CategorizedTransaction,
    CategorizationRequest,
    CategorizationResponse,
    CategoryResponse
)

router = APIRouter()


@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    """
    Get list of available transaction categories
    """
    return [
        CategoryResponse(
            id=cat_id,
            name=cat_info["name"],
            icon=cat_info["icon"],
            color=None
        )
        for cat_id, cat_info in DEFAULT_CATEGORIES.items()
    ]


@router.post("/", response_model=CategorizationResponse)
async def categorize_transactions(request: CategorizationRequest):
    """
    Categorize a list of transactions using AI
    
    - **transactions**: List of parsed transactions to categorize
    
    Returns transactions with assigned categories and confidence scores
    """
    
    if not request.transactions:
        raise HTTPException(
            status_code=400,
            detail="No transactions provided"
        )
    
    if len(request.transactions) > 500:
        raise HTTPException(
            status_code=400,
            detail="Maximum 500 transactions per request"
        )
    
    # Categorize using Gemini
    categorized = await gemini_service.categorize_transactions(
        request.transactions
    )
    
    return CategorizationResponse(
        success=True,
        categorized_transactions=categorized
    )


@router.post("/single")
async def categorize_single(transaction: ParsedTransaction):
    """
    Categorize a single transaction
    """
    categorized = await gemini_service.categorize_transactions([transaction])
    
    if categorized:
        return categorized[0]
    
    raise HTTPException(
        status_code=500,
        detail="Failed to categorize transaction"
    )


@router.post("/recategorize/{transaction_id}")
async def recategorize(transaction_id: int, new_category_id: int):
    """
    Manually recategorize a transaction
    
    This endpoint allows users to correct AI categorization
    """
    if new_category_id not in DEFAULT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category ID. Must be 1-{len(DEFAULT_CATEGORIES)}"
        )
    
    # In a full implementation, this would update the database
    return {
        "success": True,
        "transaction_id": transaction_id,
        "new_category_id": new_category_id,
        "new_category_name": DEFAULT_CATEGORIES[new_category_id]["name"]
    }
