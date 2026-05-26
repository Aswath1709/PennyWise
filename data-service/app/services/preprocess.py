# services/preprocess.py

"""
Transaction Processing: Sanitization and Categorization
EXACT LOGIC from original preprocess.py

Sanitize: Remove sensitive info (card numbers, phone, transaction IDs, etc.)
Categorize: Use Gemini LLM to categorize merchants
"""

import re
import json
from typing import List, Dict, Optional

# ========== CATEGORIES (all 13 from original PennyWise) ==========
# Database IDs: 1-14 (11 original + 3 new)

CATEGORIES = [
    "groceries", "dining", "transport", "subscriptions",
    "utilities", "shopping", "entertainment", "health",
    "rent", "income", "fees", "transfer", "other"
]

# Map category names to database IDs
CATEGORY_TO_ID = {
    "dining": 1,        # Food & Dining
    "groceries": 2,     # Groceries
    "transport": 3,     # Transportation
    "shopping": 4,      # Shopping
    "entertainment": 5, # Entertainment
    "utilities": 6,     # Bills & Utilities
    "health": 7,        # Healthcare
    "healthcare": 7,    # Alias
    "travel": 8,        # Travel
    "income": 9,        # Income
    "transfer": 10,     # Transfer
    "other": 11,        # Other
    "subscriptions": 12,# Subscriptions (new)
    "rent": 13,         # Rent (new)
    "fees": 14,         # Fees (new)
}

def get_category_id(category_name: str) -> int:
    """Get database category ID from category name."""
    return CATEGORY_TO_ID.get(category_name.lower(), 11)  # Default to "other" (11)

CATEGORIZATION_PROMPT = """Categorize each merchant into exactly ONE category.

Categories: {categories}

Merchants:
{merchants}

Return ONLY a JSON array of category strings, one per merchant, in the same order.
Example: ["dining", "groceries", "transport"]

Rules:
- Supermarkets, food stores → groceries
- Restaurants, cafes, fast food, coffee shops → dining
- Uber, Lyft, gas stations, parking, transit → transport
- Netflix, Spotify, gym memberships, monthly services → subscriptions
- Electric, water, internet, phone bills → utilities
- Amazon, retail stores, clothing → shopping
- Movies, concerts, gaming, events → entertainment
- Pharmacy, doctor, hospital, medical → health
- Rent, lease, mortgage, housing → rent
- Payroll, salary, deposits, refunds → income
- Bank fees, ATM fees, interest charges → fees
- Zelle, Venmo, bank transfers → transfer
- Unknown or uncategorized → other

Return ONLY valid JSON array, no explanation."""

# ========== SANITIZATION PATTERNS (EXACT from original) ==========

SANITIZE_PATTERNS = [
    # Card numbers (full or partial)
    (r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', '[CARD]'),
    (r'\b(?:ending\s*(?:in)?|last\s*4|x{4,})\s*\d{4}\b', '[CARD]'),
    (r'\bCard\s+\d{4}\b', '[CARD]', re.IGNORECASE),

    # Account numbers (6+ digits)
    (r'\b(?:acct?|account)\.?\s*#?\s*\d{6,}\b', '[ACCOUNT]', re.IGNORECASE),

    # Transaction/Reference/Confirmation numbers
    (r'\b(?:trans(?:action)?|ref(?:erence)?|conf(?:irmation)?|trace|auth(?:orization)?)\s*#?\s*:?\s*[A-Z0-9]{6,}\b',
     '[REF]', re.IGNORECASE),

    # Check numbers
    (r'\b(?:check|chk|cheque)\s*#?\s*:?\s*\d{3,}\b', '[CHECK]', re.IGNORECASE),

    # Phone numbers
    (r'\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE]'),

    # Email addresses
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]'),

    # SSN
    (r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b', '[SSN]'),

    # Generic long numbers (8+ digits)
    (r'\b\d{8,}\b', '[ID]'),

    # Alphanumeric reference codes
    (r'\b[A-Z]{2,}[0-9]{6,}\b', '[REF]'),
    (r'\b[0-9]{3,}[A-Z]{2,}[0-9]{2,}\b', '[REF]'),
]


# ========== SANITIZATION (EXACT from original) ==========

def _sanitize_description(text: str) -> str:
    """Apply all sanitization patterns to a description. EXACT from original."""
    if not isinstance(text, str):
        return text

    result = text

    for pattern_tuple in SANITIZE_PATTERNS:
        if len(pattern_tuple) == 3:
            pattern, replacement, flags = pattern_tuple
            result = re.sub(pattern, replacement, result, flags=flags)
        else:
            pattern, replacement = pattern_tuple
            result = re.sub(pattern, replacement, result)

    result = re.sub(r'\s+', ' ', result).strip()
    result = re.sub(r'(\[\w+\])(?:\s*\1)+', r'\1', result)

    return result


# Alias for external use
sanitize_description = _sanitize_description


def sanitize(transactions: List[dict]) -> List[dict]:
    """Remove sensitive information from transactions. Adapts original for list of dicts."""
    result = []
    for t in transactions:
        t_copy = t.copy()
        t_copy['Description'] = _sanitize_description(t_copy['Description'])
        result.append(t_copy)
    return result


# ========== CATEGORIZATION (EXACT from original) ==========

def _parse_llm_response(response_text: str, expected_count: int) -> List[str]:
    """Parse JSON array from LLM response. EXACT from original."""
    try:
        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```\w*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)

        categories = json.loads(text)

        if len(categories) != expected_count:
            print(f"  Warning: Expected {expected_count} categories, got {len(categories)}")
            if len(categories) < expected_count:
                categories.extend(['other'] * (expected_count - len(categories)))
            else:
                categories = categories[:expected_count]

        categories = [c if c in CATEGORIES else 'other' for c in categories]
        return categories

    except json.JSONDecodeError as e:
        print(f"  Error parsing LLM response: {e}")
        return ['other'] * expected_count


# Alias for external use
parse_llm_response = _parse_llm_response


def _categorize_with_gemini(merchants: List[str], batch_size: int = 50) -> List[str]:
    """Categorize merchants using Gemini API. EXACT logic from original."""
    try:
        from app.config import get_settings
        import google.generativeai as genai
        
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
    except Exception as e:
        print(f"Gemini not available: {e}")
        return ['other'] * len(merchants)

    all_categories = []

    for i in range(0, len(merchants), batch_size):
        batch = merchants[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(merchants) + batch_size - 1) // batch_size

        print(f"  Processing batch {batch_num}/{total_batches}...")

        merchants_text = "\n".join(f"{j + 1}. {m}" for j, m in enumerate(batch))

        prompt = CATEGORIZATION_PROMPT.format(
            categories=", ".join(CATEGORIES),
            merchants=merchants_text
        )

        try:
            response = model.generate_content(prompt)
            categories = _parse_llm_response(response.text, len(batch))
            all_categories.extend(categories)
        except Exception as e:
            print(f"  Gemini error: {e}")
            all_categories.extend(['other'] * len(batch))

    return all_categories


def categorize_by_keywords(description: str) -> str:
    """Fallback keyword-based categorization for all 13 categories."""
    desc_lower = description.lower()

    keyword_map = {
        'groceries': ['walmart', 'target', 'costco', 'kroger', 'safeway', 'whole foods', 
                      'trader joe', 'grocery', 'market', 'aldi', 'publix', 'wegmans',
                      'stop & shop', 'supermarket', 'food lion'],
        'dining': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'doordash', 
                   'ubereats', 'grubhub', 'chipotle', 'mcdonald', 'starbucks', 'dunkin',
                   'wendys', 'taco bell', 'panera', 'subway', 'chick-fil-a', 'diner'],
        'transport': ['uber', 'lyft', 'gas', 'shell', 'chevron', 'exxon', 'bp', 'mobil',
                      'parking', 'transit', 'mbta', 'metro', 'taxi', 'fuel', 'car wash',
                      'amtrak', 'train'],
        'subscriptions': ['netflix', 'spotify', 'hulu', 'disney+', 'hbo', 'youtube premium',
                          'amazon prime', 'apple music', 'gym', 'fitness', 'membership',
                          'subscription', 'monthly', 'annual', 'dropbox', 'icloud',
                          'adobe', 'microsoft 365'],
        'utilities': ['electric', 'water', 'internet', 'phone', 'verizon', 'at&t', 
                      'comcast', 'utility', 'xfinity', 't-mobile', 'sprint', 'gas bill',
                      'power', 'energy', 'cable', 'sewage'],
        'shopping': ['amazon', 'ebay', 'best buy', 'apple store', 'nike', 'clothing', 'store', 
                     'mall', 'shop', 'retail', 'nordstrom', 'macys', 'gap', 'old navy',
                     'ikea', 'home depot', 'lowes', 'wayfair'],
        'entertainment': ['movie', 'theater', 'cinema', 'amc', 'concert', 'gaming', 
                          'xbox', 'playstation', 'steam', 'twitch', 'ticket', 'event',
                          'show', 'museum', 'theme park'],
        'health': ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'medical', 
                   'dental', 'health', 'clinic', 'urgent care', 'insurance', 'rx',
                   'healthcare', 'optometrist', 'vision'],
        'rent': ['rent', 'lease', 'landlord', 'apartment', 'housing', 'mortgage',
                 'property', 'hoa', 'condo'],
        'income': ['payroll', 'direct deposit', 'salary', 'income', 'payment received',
                   'ach credit', 'wire transfer in', 'deposit', 'refund', 'reimbursement'],
        'fees': ['fee', 'charge', 'interest', 'late fee', 'overdraft', 'atm fee',
                 'service charge', 'annual fee', 'maintenance fee', 'penalty'],
        'transfer': ['transfer', 'zelle', 'venmo', 'paypal', 'wire', 'ach', 'cash app',
                     'payment to', 'payment from', 'online transfer', 'bank transfer'],
    }

    for category, keywords in keyword_map.items():
        if any(kw in desc_lower for kw in keywords):
            return category

    return 'other'


def categorize(transactions: List[dict]) -> List[dict]:
    """Categorize transactions using Gemini LLM. Adapts original for list of dicts."""
    if not transactions:
        return []

    unique_merchants = list(set(t['Description'] for t in transactions))
    print(f"Found {len(unique_merchants)} unique merchants")

    # Try Gemini categorization
    try:
        from app.config import get_settings
        settings = get_settings()
        if settings.gemini_api_key:
            print(f"Categorizing {len(unique_merchants)} merchants via Gemini...")
            categories = _categorize_with_gemini(unique_merchants)
            merchant_to_category = dict(zip(unique_merchants, categories))
        else:
            print("No Gemini API key, using keyword categorization")
            merchant_to_category = {m: categorize_by_keywords(m) for m in unique_merchants}
    except Exception as e:
        print(f"Gemini failed, using keywords: {e}")
        merchant_to_category = {m: categorize_by_keywords(m) for m in unique_merchants}

    # Apply categories
    result = []
    for t in transactions:
        t_copy = t.copy()
        t_copy['Category'] = merchant_to_category.get(t['Description'], 'other')
        result.append(t_copy)

    return result


def process_transactions(transactions: List[dict], preview: bool = False) -> List[dict]:
    """Full pipeline: sanitize → categorize. Adapts original for list of dicts."""
    print("=" * 40)
    print("PROCESSING TRANSACTIONS")
    print("=" * 40)

    print("\n[1/2] Sanitizing...")
    transactions = sanitize(transactions)
    print(f"  Sanitized {len(transactions)} transactions")

    print("\n[2/2] Categorizing...")
    transactions = categorize(transactions)
    print(f"  Categorized {len(transactions)} transactions")

    print("\n" + "=" * 40)
    print("CATEGORY SUMMARY")
    print("=" * 40)
    category_counts = {}
    for t in transactions:
        cat = t.get('Category', 'other')
        category_counts[cat] = category_counts.get(cat, 0) + 1
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    return transactions