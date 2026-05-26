# services/gemini_service.py

"""
Gemini AI Service - EXACT COPY from original agent.py + compare_to_external from tools.py

Handles:
- Transaction categorization 
- Natural language queries
- External comparisons via Google Search
- Insights generation
"""

import json
import re
from typing import List, Dict, Optional
from app.config import get_settings
from app.models.schemas import ParsedTransaction, CategorizedTransaction
from app.services.preprocess import (
    CATEGORIES, CATEGORIZATION_PROMPT, sanitize_description, 
    categorize_by_keywords, parse_llm_response, get_category_id
)

settings = get_settings()

# Default categories with icons for the API (all 14 categories)
DEFAULT_CATEGORIES = {
    1: {"name": "Food & Dining", "icon": "🍔"},
    2: {"name": "Groceries", "icon": "🛒"},
    3: {"name": "Transportation", "icon": "🚗"},
    4: {"name": "Shopping", "icon": "🛍️"},
    5: {"name": "Entertainment", "icon": "🎬"},
    6: {"name": "Bills & Utilities", "icon": "💡"},
    7: {"name": "Healthcare", "icon": "🏥"},
    8: {"name": "Travel", "icon": "✈️"},
    9: {"name": "Income", "icon": "💰"},
    10: {"name": "Transfer", "icon": "🔄"},
    11: {"name": "Other", "icon": "📦"},
    12: {"name": "Subscriptions", "icon": "📱"},
    13: {"name": "Rent", "icon": "🏠"},
    14: {"name": "Fees", "icon": "💳"},
}

# Configure Gemini using new google.genai SDK
try:
    from google import genai
    from google.genai import types as genai_types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None
    genai_types = None


# ========== SYSTEM PROMPT - from original agent.py ==========

SYSTEM_PROMPT = """You are a personal finance advisor with access to the user's transaction data.

SCOPE - IMPORTANT:
- You help with personal finance questions
- If a question is NOT about finances, spending, budgeting, savings, investments, or money → politely decline
- For off-topic questions (math problems, trivia, coding, sports), say: "I'm your personal finance assistant. I can help with questions about your spending, budgets, and financial comparisons."

RULES:
1. ALWAYS base your answers on the actual data provided
2. Use specific numbers from the data
3. Be concise and actionable
4. Format currency with $ and commas (e.g., $1,234.56)
5. If asked about comparisons to averages, provide the comparison data

RESPONSE FORMATTING:
- Keep responses under 200 words
- Use bullet points for lists
- Highlight important numbers
"""


class GeminiService:
    """Service for AI-powered features - matches original agent.py"""

    def __init__(self):
        self.client = None
        self.model_name = settings.gemini_model

        if GENAI_AVAILABLE and settings.gemini_api_key:
            self.client = genai.Client(api_key=settings.gemini_api_key)

    # ========== CATEGORIZATION ==========

    async def categorize_transactions(
            self,
            transactions: List[ParsedTransaction]
    ) -> List[CategorizedTransaction]:
        """Categorize transactions using Gemini."""
        
        # Helper to get field from dict or object
        def get_field(t, field, default=None):
            if isinstance(t, dict):
                return t.get(field, default)
            return getattr(t, field, default)

        if not self.client:
            return self._keyword_categorize(transactions)

        try:
            # Get unique merchants
            unique_merchants = list(set(get_field(t, 'description', '') for t in transactions))

            # Sanitize descriptions
            sanitized_merchants = [sanitize_description(m) for m in unique_merchants]

            # Categorize with Gemini
            merchants_text = "\n".join(f"{i + 1}. {m}" for i, m in enumerate(sanitized_merchants))

            prompt = CATEGORIZATION_PROMPT.format(
                categories=", ".join(CATEGORIES),
                merchants=merchants_text
            )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            # Parse response
            categories = parse_llm_response(response.text, len(unique_merchants))

            # Build merchant -> category map
            merchant_category = {m: c for m, c in zip(unique_merchants, categories)}

            # Apply to all transactions
            result = []
            for t in transactions:
                desc = get_field(t, 'description', '')
                category = merchant_category.get(desc, 'other')

                # KEEP THE ORIGINAL SIGNED AMOUNT FROM PDF PARSER
                # pdf_parser already returns: negative = expense, positive = income
                amount = get_field(t, 'amount', 0)

                result.append(CategorizedTransaction(
                    date=get_field(t, 'date'),
                    description=sanitize_description(desc),
                    amount=amount,
                    type=get_field(t, 'type', 'debit'),
                    category_id=get_category_id(category),
                    category_name=category,
                    confidence=0.85
                ))

            return result

        except Exception as e:
            print(f"Gemini categorization error: {e}")
            return self._keyword_categorize(transactions)

    def _keyword_categorize(self, transactions: List[ParsedTransaction]) -> List[CategorizedTransaction]:
        """Fallback keyword-based categorization."""

        result = []
        for t in transactions:
            # Handle both dict and object
            if isinstance(t, dict):
                desc = t.get('description', '')
                amount = t.get('amount', 0)
                date = t.get('date')
                tx_type = t.get('type', 'debit')
            else:
                desc = t.description
                amount = t.amount
                date = t.date
                tx_type = t.type
            
            category = categorize_by_keywords(desc)
            
            # KEEP THE ORIGINAL SIGNED AMOUNT FROM PDF PARSER

            result.append(CategorizedTransaction(
                date=date,
                description=sanitize_description(desc),
                amount=amount,
                type=tx_type,
                category_id=get_category_id(category),
                category_name=category,
                confidence=0.7
            ))

        return result

    # ========== EXTERNAL COMPARISON - from original tools.py ==========

    async def compare_to_external(
            self,
            category: str,
            user_monthly_spending: float,
            location: str = "USA",
            household_type: str = "single",
            period: str = "monthly"
    ) -> Dict:
        """Compare user's spending to REAL-TIME external benchmarks using Google Search."""

        # Build household description for search
        household_desc = ""
        if household_type and household_type.lower() != "single":
            household_desc = f" for {household_type}"

        benchmark_amount = None
        benchmark_text = ""
        source_url = None  # Only from grounding metadata - NEVER from LLM text
        source_title = None

        # Try Google Search via genai client
        if self.client and GENAI_AVAILABLE:
            try:
                search_query = f"average {category} spending per month{household_desc} in {location} 2024 2025"

                config = genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    system_instruction="""Extract the average spending amount from search results.
Return ONLY the dollar amount like: $XXX per month
If no data found, say: No data found"""
                )

                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=search_query,
                    config=config
                )

                benchmark_text = response.text

                # ONLY get URLs from grounding metadata - these are REAL URLs
                # NEVER trust URLs in the LLM's text response (they hallucinate)
                try:
                    if hasattr(response, 'candidates') and response.candidates:
                        candidate = response.candidates[0]
                        if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                            grounding = candidate.grounding_metadata

                            # Get URL from grounding chunks
                            if hasattr(grounding, 'grounding_chunks') and grounding.grounding_chunks:
                                for chunk in grounding.grounding_chunks:
                                    if hasattr(chunk, 'web') and chunk.web:
                                        source_url = chunk.web.uri
                                        if hasattr(chunk.web, 'title'):
                                            source_title = chunk.web.title
                                        break
                except Exception:
                    pass  # Grounding metadata not available

                # Extract dollar amount from response
                numbers = re.findall(r'\$?([\d,]+(?:\.\d{2})?)', benchmark_text)
                if numbers:
                    for num in numbers:
                        try:
                            val = float(num.replace(',', ''))
                            if 20 <= val <= 15000:
                                benchmark_amount = val
                                break
                        except:
                            continue

            except Exception as e:
                benchmark_text = f"Google Search failed: {str(e)}"

        # NO FALLBACK - if no data, return that clearly
        if not benchmark_amount:
            return {
                "category": category,
                "your_spending": f"${user_monthly_spending:,.2f}/{period}",
                "location": location,
                "household_type": household_type,
                "benchmark": "No data available",
                "error": f"Could not find benchmark data for '{category}' in {location} for {household_type}",
                "search_result": benchmark_text,
                "suggestion": "Try a more common category like: groceries, dining, rent, utilities, entertainment"
            }

        # Compare and return
        diff = user_monthly_spending - benchmark_amount
        diff_pct = ((user_monthly_spending / benchmark_amount) - 1) * 100

        if diff < 0:
            status = "🟢 BELOW AVERAGE"
            insight = f"You spend ${abs(diff):,.0f} ({abs(diff_pct):.0f}%) LESS than average for a {household_type}. Great job!"
        elif diff > 0:
            status = "🔴 ABOVE AVERAGE"
            insight = f"You spend ${diff:,.0f} ({diff_pct:.0f}%) MORE than average for a {household_type}."
        else:
            status = "🟡 AVERAGE"
            insight = f"Your spending is right at the average for a {household_type}."

        # Build source info - only use verified URLs from grounding metadata
        if source_url:
            source_display = f"{source_title or 'Source'}: {source_url}"
        else:
            source_display = "Source: Google Search (specific URL not available in metadata)"

        result = {
            "category": category,
            "your_spending": f"${user_monthly_spending:,.2f}/{period}",
            "benchmark": f"${benchmark_amount:,.2f}/{period}",
            "location": location,
            "household_type": household_type,
            "difference": f"${diff:+,.2f}",
            "difference_percent": f"{diff_pct:+.1f}%",
            "status": status,
            "insight": insight,
            "source": source_display,
            "source_url": source_url if source_url else None
        }

        return result

    async def compare_all_to_external(
            self,
            spending_by_category: List[Dict],
            location: str = "USA",
            household_type: str = "single",
            top_n: int = 5
    ) -> Dict:
        """Compare ALL of user's top spending categories to external benchmarks at once."""

        # Sort and take top N
        sorted_cats = sorted(spending_by_category, key=lambda x: x.get('total_amount', 0), reverse=True)[:top_n]

        comparisons = []
        above_average = []
        below_average = []
        no_data_categories = []

        for cat_data in sorted_cats:
            category = cat_data.get('category_name', cat_data.get('category', 'Unknown'))
            amount = cat_data.get('total_amount', 0)

            # Skip non-spending categories
            if category.lower() in ['transfer', 'income', 'other']:
                continue

            result = await self.compare_to_external(
                category=category,
                user_monthly_spending=amount,
                location=location,
                household_type=household_type
            )

            comparisons.append(result)

            if 'error' in result:
                no_data_categories.append(category)
            elif '🔴' in result.get('status', ''):
                above_average.append(category)
            elif '🟢' in result.get('status', ''):
                below_average.append(category)

        # Build summary
        if above_average:
            summary = f"As a {household_type} in {location}, you're spending ABOVE average on: {', '.join(above_average)}"
        elif below_average:
            summary = f"As a {household_type} in {location}, you're at or below average in all categories with data!"
        else:
            summary = "Could not find benchmark data for comparison."

        return {
            "location": location,
            "household_type": household_type,
            "comparisons": comparisons,
            "above_average_categories": above_average,
            "below_average_categories": below_average,
            "no_data_categories": no_data_categories,
            "summary": summary
        }

    # Alias for backwards compatibility
    async def compare_all_categories(self, *args, **kwargs):
        return await self.compare_all_to_external(*args, **kwargs)

    # ========== NATURAL LANGUAGE QUERY - from original agent.py ==========

    async def process_natural_query(
            self,
            query: str,
            transactions_summary: Dict
    ) -> Dict:
        """Process natural language query about finances."""

        if not self.client:
            return {
                "response": "AI service is not configured. Please add your Gemini API key.",
                "data": None
            }

        try:
            prompt = f"""{SYSTEM_PROMPT}

User's Financial Data:
{json.dumps(transactions_summary, indent=2, default=str)}

User Question: {query}

Provide a helpful, specific answer based on the data. Use actual numbers.
Keep response under 200 words.

Return JSON:
{{
  "response": "Your answer here",
  "data": null or relevant data object
}}"""

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            response_text = response.text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]

            return json.loads(response_text)

        except Exception as e:
            print(f"NLP query error: {e}")
            return {
                "response": f"I couldn't process your question. Error: {str(e)}",
                "data": None
            }

    # ========== INSIGHTS GENERATION ==========

    async def generate_insights(
            self,
            spending_data: Dict,
            monthly_data: List[Dict]
    ) -> List[Dict]:
        """Generate AI insights from spending data."""

        if not self.client:
            return self._basic_insights(spending_data, monthly_data)

        try:
            prompt = f"""Analyze this financial data and provide 3-5 actionable insights.

Spending by Category:
{json.dumps(spending_data, indent=2)}

Monthly Trends:
{json.dumps(monthly_data, indent=2)}

Provide insights in JSON format:
[
  {{
    "title": "Brief title",
    "insight_text": "Detailed insight with specific numbers from the data",
    "insight_type": "spending|saving|trend|anomaly|recommendation"
  }}
]

Focus on specific numbers, unusual patterns, and actionable recommendations.
Only return valid JSON."""

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            response_text = response.text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]

            return json.loads(response_text)

        except Exception as e:
            print(f"Insights generation error: {e}")
            return self._basic_insights(spending_data, monthly_data)

    def _basic_insights(self, spending_data: Dict, monthly_data: List[Dict]) -> List[Dict]:
        """Generate basic insights without AI."""
        insights = []

        if spending_data.get("spending_by_category"):
            top_cat = max(spending_data["spending_by_category"], key=lambda x: x.get("total_amount", 0))
            insights.append({
                "title": "Top Spending Category",
                "insight_text": f"Your highest spending is in {top_cat['category_name']} at ${top_cat['total_amount']:.2f}",
                "insight_type": "spending"
            })

        if len(monthly_data) >= 2:
            latest = monthly_data[-1]
            previous = monthly_data[-2]
            change = latest.get("total_spending", 0) - previous.get("total_spending", 0)
            direction = "increased" if change > 0 else "decreased"
            insights.append({
                "title": "Monthly Spending Trend",
                "insight_text": f"Your spending {direction} by ${abs(change):.2f} compared to last month",
                "insight_type": "trend"
            })

        return insights


# Singleton instance
gemini_service = GeminiService()