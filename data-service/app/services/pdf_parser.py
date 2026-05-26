import re
import pdfplumber
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from abc import ABC, abstractmethod

class BaseBankParser(ABC):
    """Abstract base class for all bank statement parsers."""
    
    @abstractmethod
    def extract_metadata(self, text: str) -> Tuple[Optional[str], int, int]:
        """Returns (account_last4, statement_month, statement_year)"""
        pass

    @abstractmethod
    def parse_transactions(self, text: str, stmt_month: int, stmt_year: int) -> List[Dict]:
        """Returns a list of transaction dictionaries: {'Date': datetime, 'Description': str, 'Amount': float}"""
        pass

class ChaseParser(BaseBankParser):
    """Strategy for parsing JPMorgan Chase statements."""
    
    SKIP_KEYWORDS = ['TOTAL', 'BALANCE', 'PAGE', 'STATEMENT', 'BILLING', 'FEES', 'INTEREST', 'DATE DESCRIPTION']

    def extract_metadata(self, text: str) -> Tuple[Optional[str], int, int]:
        # Account Number
        acct_match = re.search(r'(?:account|acct|card|ending in)[\s#:]*[\dxX*\s-]*(\d{4})\b', text, re.IGNORECASE)
        last4 = acct_match.group(1) if acct_match else None
        
        # Statement Date
        text_dates = re.findall(r'([a-zA-Z]+)\s+\d{1,2},\s+(\d{4})', text)
        if text_dates:
            month_str, year_str = text_dates[-1]
            month_str = month_str.lower()
            months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            month = next((i + 1 for i, m in enumerate(months) if month_str.startswith(m)), datetime.now().month)
            return last4, month, int(year_str)

        date_match = re.search(r'(?:Statement Date|through|Period| -)[:\s]*(\d{1,2})/\d{1,2}/(\d{2,4})', text, re.IGNORECASE)
        if not date_match:
            date_match = re.search(r'\b(\d{1,2})/\d{1,2}/(\d{2,4})\b', text)

        if date_match:
            month, year = int(date_match.group(1)), int(date_match.group(2))
            year = year + 2000 if year < 100 else year
        else:
            month, year = datetime.now().month, datetime.now().year
            
        return last4, month, year

    def parse_transactions(self, text: str, stmt_month: int, stmt_year: int) -> List[Dict]:
        pattern = r'^(\d{2}/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})(?:\s+[\d,]+\.\d{2})?\s*$'
        transactions = []
        
        for line in text.split('\n'):
            line = line.strip()
            if any(kw in line.upper() for kw in self.SKIP_KEYWORDS): continue
            
            match = re.match(pattern, line)
            if match:
                date_str, desc, amt_str = match.groups()
                m, d = map(int, date_str.split('/'))
                year = stmt_year - 1 if m > stmt_month else stmt_year
                
                transactions.append({
                    'Date': datetime(year, m, d),
                    'Description': desc,
                    'Amount': float(amt_str.replace(',', ''))
                })
        return transactions

class BankOfAmericaParser(BaseBankParser):
    """Placeholder strategy for parsing Bank of America statements."""
    
    def extract_metadata(self, text: str) -> Tuple[Optional[str], int, int]:
        # Implement BoA specific metadata extraction here
        return None, datetime.now().month, datetime.now().year

    def parse_transactions(self, text: str, stmt_month: int, stmt_year: int) -> List[Dict]:
        # Implement BoA specific transaction extraction here
        return []

class PNCParser(BaseBankParser):
    """Strategy for parsing PNC Bank statements."""
    
    def extract_metadata(self, text: str) -> Tuple[Optional[str], int, int]:
        # Account Number
        acct_match = re.search(r'Primary account number:\s*XX-XXXX-(\d{4})', text, re.IGNORECASE)
        last4 = acct_match.group(1) if acct_match else None
        
        # Statement Date
        date_match = re.search(r'For the period (\d{2})/\d{2}/(\d{4}) to', text, re.IGNORECASE)
        if date_match:
            month, year = map(int, date_match.groups())
        else:
            month, year = datetime.now().month, datetime.now().year
            
        return last4, month, year

    def parse_transactions(self, text: str, stmt_month: int, stmt_year: int) -> List[Dict]:
        transactions = []
        current_sign = -1 # default to debit
        
        pattern = r'^(\d{2}/\d{2})\s+([\d,]+\.\d{2})\s+(.+)$'
        
        for line in text.split('\n'):
            line = line.strip()
            
            # State switching based on section headers
            if "Deposits and Other Additions" in line or "Additions" in line:
                current_sign = 1
            elif "Deductions" in line or "Checks" in line or "Withdrawals" in line:
                current_sign = -1
                
            match = re.match(pattern, line)
            if match:
                date_str, amt_str, desc = match.groups()
                m, d = map(int, date_str.split('/'))
                year = stmt_year - 1 if m > stmt_month else stmt_year
                
                amount = float(amt_str.replace(',', '')) * current_sign
                
                transactions.append({
                    'Date': datetime(year, m, d),
                    'Description': desc.strip(),
                    'Amount': amount
                })
        return transactions

class PDFParser:
    def __init__(self):
        # Register available strategies
        self.strategies = {
            "Chase": ChaseParser(),
            "Bank of America": BankOfAmericaParser(),
            "PNC": PNCParser(),
            # Add more strategies here
        }

    def _detect_bank(self, text: str) -> str:
        """Analyze the text to determine which bank the statement belongs to."""
        text_upper = text.upper()
        if "JPMORGAN CHASE" in text_upper or "CHASE BANK" in text_upper or "CHASE.COM" in text_upper:
            return "Chase"
        elif "BANK OF AMERICA" in text_upper or "BANKOFAMERICA.COM" in text_upper:
            return "Bank of America"
        elif "PNC BANK" in text_upper or "PNC.COM" in text_upper:
            return "PNC"
        
        # Default to Chase if we can't identify it, so legacy uploads don't break
        return "Chase"

    def parse(self, pdf_content: bytes, statement_type: str = "debit") -> dict:
        try:
            full_text = ""
            with pdfplumber.open(BytesIO(pdf_content)) as pdf:
                full_text = "\n".join([p.extract_text() or "" for p in pdf.pages])

            # Detect bank and select the correct parser strategy
            bank_name = self._detect_bank(full_text)
            strategy = self.strategies.get(bank_name)
            
            if not strategy:
                return {"success": False, "message": f"Unsupported bank: {bank_name}", "transactions": []}

            # Delegate parsing to the chosen strategy
            account_last4, stmt_month, stmt_year = strategy.extract_metadata(full_text)
            transactions = strategy.parse_transactions(full_text, stmt_month, stmt_year)
            
            # Standardize and sort the output
            transactions = sorted(transactions, key=lambda x: x['Date'])
            
            if not transactions:
                return {"success": False, "message": f"No transactions found using {bank_name} parser", "transactions": []}

            api_txs = [{
                "date": t['Date'].date(),
                "description": t['Description'],
                "amount": float(t['Amount']),
                "type": "credit" if t['Amount'] > 0 else "debit"
            } for t in transactions]

            return {
                "success": True,
                "message": f"Successfully parsed {len(api_txs)} transactions using {bank_name} parser",
                "bank_name": bank_name,
                "account_last4": account_last4,
                "statement_start_date": api_txs[0]["date"] if api_txs else None,
                "statement_end_date": api_txs[-1]["date"] if api_txs else None,
                "transactions": api_txs,
                "transactions_count": len(api_txs)
            }
        except Exception as e:
            return {"success": False, "message": str(e), "transactions": []}

pdf_parser = PDFParser()