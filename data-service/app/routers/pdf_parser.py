"""
PDF Parser API Router
Handles bank statement PDF uploads and parsing
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
from app.services.pdf_parser import pdf_parser
from app.models.schemas import PDFParseResponse
from app.config import get_settings

router = APIRouter()
settings = get_settings()


def detect_statement_type(content: bytes) -> str:
    """Auto-detect if this is a credit card or checking/debit statement."""
    import pdfplumber
    from io import BytesIO
    
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            text = ""
            for page in pdf.pages[:2]:  # Check first 2 pages
                page_text = page.extract_text() or ""
                text += page_text.upper()
            
            # Credit card indicators
            credit_indicators = ['CREDIT CARD', 'SAPPHIRE', 'FREEDOM', 'SLATE', 'AMAZON PRIME', 
                                 'MARRIOTT', 'UNITED', 'SOUTHWEST', 'INK', 'AARP',
                                 'MINIMUM PAYMENT', 'CREDIT LIMIT', 'AVAILABLE CREDIT',
                                 'NEW BALANCE', 'PAYMENT DUE']
            
            # Checking/Debit indicators
            debit_indicators = ['CHECKING', 'SAVINGS', 'DEBIT CARD', 'ATM', 'BEGINNING BALANCE',
                               'ENDING BALANCE', 'DEPOSITS AND ADDITIONS', 'ELECTRONIC WITHDRAWALS']
            
            credit_score = sum(1 for ind in credit_indicators if ind in text)
            debit_score = sum(1 for ind in debit_indicators if ind in text)
            
            if debit_score > credit_score:
                return "debit"
            return "credit"
    except:
        return "credit"  # Default to credit


@router.post("/parse", response_model=PDFParseResponse)
async def parse_pdf(
    file: UploadFile = File(...),
    statement_type: Optional[str] = Form(None)
):
    """
    Parse a Chase bank statement PDF and extract transactions
    
    - **file**: PDF file upload (max 10MB)
    - **statement_type**: "credit" or "debit" (auto-detected if not provided)
    
    Returns parsed transactions with dates, descriptions, and amounts
    """
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > settings.max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_file_size // (1024*1024)}MB"
        )
    
    # Auto-detect statement type if not provided
    if not statement_type:
        statement_type = detect_statement_type(content)
    
    # Parse PDF
    result = pdf_parser.parse(content, statement_type=statement_type)
    
    return PDFParseResponse(**result)


@router.post("/parse-and-categorize")
async def parse_and_categorize(
    file: UploadFile = File(...),
    statement_type: Optional[str] = Form(None)
):
    """
    Parse a PDF and automatically categorize transactions using AI
    
    - **file**: PDF file upload
    - **statement_type**: "credit" or "debit" (auto-detected if not provided)
    
    Combines PDF parsing with Gemini AI categorization in one step
    """
    from app.services.gemini_service import gemini_service
    
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    content = await file.read()
    
    if len(content) > settings.max_file_size:
        raise HTTPException(status_code=400, detail="File too large")
    
    # Auto-detect statement type if not provided
    if not statement_type:
        statement_type = detect_statement_type(content)
    
    # Parse PDF
    parse_result = pdf_parser.parse(content, statement_type=statement_type)
    
    if not parse_result["success"]:
        raise HTTPException(status_code=400, detail=parse_result["message"])
    
    # Categorize transactions
    categorized = await gemini_service.categorize_transactions(
        parse_result["transactions"]
    )
    
    return {
        "success": True,
        "message": f"Parsed and categorized {len(categorized)} transactions",
        "bank_name": parse_result["bank_name"],
        "account_last4": parse_result.get("account_last4"),
        "statement_type": statement_type,
        "statement_start_date": parse_result.get("statement_start_date"),
        "statement_end_date": parse_result.get("statement_end_date"),
        "transactions_count": len(categorized),
        "transactions": [t.model_dump() for t in categorized]
    }