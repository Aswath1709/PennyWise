# services/agent_service.py

import os
import json
from typing import List, Dict

try:
    from google import genai
    from google.genai import types as genai_types
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    GENAI_AVAILABLE = False
from app.services.analytics_service import FinanceTools, get_gemini_tools

# 1. RULE-BASED SYSTEM PROMPT
# Notice we no longer ask for JSON. We just explain the *concepts* of finance.
SYSTEM_PROMPT = """You are an expert personal finance AI assistant.
Your job is to use the provided tools to analyze the user's financial data and answer their questions.

CRITICAL RULES FOR TOOL USAGE:
1. 'aggregate': Use for ANY totals, sums, or averages. Set income_only/expenses_only appropriately.
2. 'create_chart': Use ONLY for an overall spending pie/bar chart with no time filter.
3. 'query_transactions': Use to LIST specific transactions by category or keyword.
4. 'find_recurring': Use for recurring charges, subscriptions, or repeated payments.
5. 'compare_periods': Use to compare TOTAL spending between exactly two months/periods.
   - Pass period1 and period2 as 'Month YYYY' (e.g. 'October 2024').
6. 'category_breakdown_by_period': Use when asked for per-category spending in a specific month.
   - Also use for comparing categories across two months.
7. 'spending_trend': Use when asked about monthly trend, how spending changed over time,
   or month-by-month breakdown. Optionally pass a category.
8. 'top_merchants': Use when asked about top vendors, where they spend the most,
   biggest merchants, or which stores cost the most.
9. 'find_anomalies': Use when asked about unusual transactions, outliers, suspicious charges,
   or anything surprisingly large.
10. 'net_savings_summary': Use when asked about net savings, income vs expenses,
    how much money is left, or overall financial health. Optionally pass a period.
11. 'biggest_transactions': Use when asked for the largest/most expensive individual purchases.
    Set transaction_type='debit' for expenses (default), 'credit' for income.

Never guess numbers. Always use a tool.
"""

class FinanceAgentService:
    """Finance agent using Gemini Native Function Calling."""

    def __init__(self, gemini_api_key: str = None):
        self.api_key = gemini_api_key or os.environ.get('GEMINI_API_KEY', '')
        self.model_name = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
        self.client = genai.Client(api_key=self.api_key) if GENAI_AVAILABLE else None
        self.finance_tools = None
        self.chart_paths = {}

    def load_transactions(self, transactions: List[Dict]):
        """Load transactions for analysis."""
        self.finance_tools = FinanceTools(transactions)

    def ask(self, query: str, session_id: str = "default", transactions: List[Dict] = None) -> Dict:
        """Process query using Gemini Native Tool Calling."""
        
        if transactions:
            self.load_transactions(transactions)

        if not self.finance_tools or self.finance_tools.df.empty:
            return {
                "response": "No transaction data available.",
                "charts": []
            }

        self.chart_paths[session_id] = []

        # Step 1: Let Gemini natively map the natural language to a tool
        if not self.client:
            return {
                "response": "AI capabilities are currently unavailable because the required Google GenAI SDK is missing. Please make sure the data-service image was rebuilt.",
                "charts": []
            }

        try:
            chat = self.client.chats.create(
                model=self.model_name,
                config=genai_types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    tools=get_gemini_tools(),
                    tool_config=genai_types.ToolConfig(
                        function_calling_config=genai_types.FunctionCallingConfig(
                            mode="ANY"
                        )
                    )
                )
            )
            response = chat.send_message(query)

            # Find a function call among all parts
            function_call = None
            for part in response.candidates[0].content.parts:
                if part.function_call and part.function_call.name:
                    function_call = part.function_call
                    break

            if not function_call:
                # No tool was called — return plain text
                return {"response": response.text, "charts": []}

            tool_name = function_call.name
            tool_params = dict(function_call.args)

        except Exception as e:
            return {
                "response": f"Error understanding query: {str(e)}",
                "charts": []
            }

        # Step 2: Execute the Python function dynamically
        try:
            result = self.finance_tools.execute(tool_name, tool_params)
        except Exception as e:
            return {
                "response": f"Error executing {tool_name}: {str(e)}",
                "charts": []
            }

        # Step 3: Track any generated charts
        chart_tools = ["create_chart", "compare_periods", "category_breakdown_by_period",
                       "spending_trend", "top_merchants"]
        if tool_name in chart_tools and result.get("chart_created"):
            chart_path = result.get("chart_path")
            if chart_path:
                self.chart_paths[session_id].append(chart_path)

        # Step 4: Format the final response
        response_text = self._format_response(tool_name, result, query)

        return {
            "response": response_text,
            "charts": self.chart_paths.get(session_id, [])
        }

    def _format_response(self, tool_name: str, result: Dict, query: str) -> str:
        """Format tool result as natural language."""
        
        if "error" in result:
            return f"I ran into an issue finding that: {result['error']}"

        if tool_name == "create_chart":
            chart_type = result.get("chart_type", "chart")
            total = result.get("total", 0)
            data = result.get("data", {})
            
            response = f"Here's your {chart_type} chart.\n\n"
            response += f"**Total: ${abs(total):,.2f}**\n\n"
            
            for cat, amount in sorted(data.items(), key=lambda x: x[1], reverse=True):
                pct = (amount / total * 100) if total > 0 else 0
                response += f"• **{cat}**: ${abs(amount):,.2f} ({pct:.1f}%)\n"
            
            return response

        elif tool_name == "aggregate":
            if "results" in result:
                total = result.get("total", 0)
                title = "Breakdown" if total > 0 else "Spending by Category"
                response = f"**{title}** (Total: ${abs(total):,.2f})\n\n"
                for cat, amount in sorted(result["results"].items(), key=lambda x: x[1], reverse=True):
                    pct = (amount / total * 100) if total > 0 else 0
                    response += f"• **{cat}**: ${abs(amount):,.2f} ({pct:.1f}%)\n"
                return response
            else:
                value = result.get("value", 0)
                return f"**Total: ${abs(value):,.2f}**"

        elif tool_name == "find_recurring":
            charges = result.get("recurring_charges", [])
            if not charges:
                return "No recurring charges found."
            
            response = "**Recurring Charges**\n\n"
            for r in charges:
                response += f"• **{r['description']}**: ${abs(r['avg_amount']):,.2f} x {r['occurrences']} times\n"
            return response

        elif tool_name == "query_transactions":
            txs = result.get("transactions", [])
            if not txs:
                return "No transactions found matching that criteria."
            
            response = f"**Found {len(txs)} Transactions:**\n\n"
            for t in txs:
                response += f"• {t['date']} | {t['description']} | ${abs(t['amount']):,.2f}\n"
            return response

        elif tool_name == "compare_periods":
            p1 = result.get("period1", "Period 1")
            p2 = result.get("period2", "Period 2")
            p1_total = result.get("period1_total", 0)
            p2_total = result.get("period2_total", 0)
            diff = result.get("difference", 0)
            pct = result.get("pct_change", 0)

            if p1_total == 0 and p2_total == 0:
                return (f"No spending data found for **{p1}** or **{p2}**. "
                        f"Make sure you have transactions from these months uploaded.")

            direction = "more" if diff > 0 else "less"
            response = f"## Spending: {p1} vs {p2}\n\n"
            response += f"• **{p1}**: ${abs(p1_total):,.2f}\n"
            response += f"• **{p2}**: ${abs(p2_total):,.2f}\n\n"
            if p1_total > 0:
                response += f"**{p2}** was **${abs(diff):,.2f} ({abs(pct):.1f}%) {direction}** than {p1}.\n"
            return response

        elif tool_name == "category_breakdown_by_period":
            p1 = result.get("period1", "Period 1")
            p2 = result.get("period2")
            cats1 = result.get("period1_categories", {})
            cats2 = result.get("period2_categories", {})
            all_cats = sorted(set(list(cats1.keys()) + list(cats2.keys())))

            if not cats1 and not cats2:
                return (f"No spending data found for **{p1}**{' or **' + p2 + '**' if p2 else ''}. "
                        f"Make sure you have transactions from this period uploaded.")

            if p2 and (cats1 or cats2):
                response = f"## Category Breakdown: {p1} vs {p2}\n\n"
                for cat in all_cats:
                    v1 = cats1.get(cat, 0)
                    v2 = cats2.get(cat, 0)
                    delta = v2 - v1
                    arrow = "▲" if delta > 0 else ("▼" if delta < 0 else "—")
                    response += f"• **{cat}**: {p1} ${v1:,.2f} → {p2} ${v2:,.2f} ({arrow} ${abs(delta):,.2f})\n"
            else:
                response = f"## Category Breakdown: {p1}\n\n"
                total = sum(cats1.values())
                for cat, amt in sorted(cats1.items(), key=lambda x: x[1], reverse=True):
                    pct_val = (amt / total * 100) if total > 0 else 0
                    response += f"• **{cat}**: ${amt:,.2f} ({pct_val:.1f}%)\n"
            return response

        elif tool_name == "spending_trend":
            months = result.get("months", {})
            avg = result.get("average_monthly", 0)
            cat = result.get("category")
            if not months:
                return "No monthly spending data found."
            header = f"## Monthly Spending Trend{' — ' + cat.title() if cat else ''}\n\n"
            response = header
            for month, amt in months.items():
                response += f"• **{month}**: ${amt:,.2f}\n"
            response += f"\n**Average**: ${avg:,.2f}/month\n"
            return response

        elif tool_name == "top_merchants":
            merchants = result.get("merchants", {})
            total = result.get("total_shown", 0)
            if not merchants:
                return "No merchant data found."
            response = f"## Top Merchants by Spending\n\n"
            for i, (name, amt) in enumerate(merchants.items(), 1):
                response += f"{i}. **{name}**: ${amt:,.2f}\n"
            response += f"\n**Total (shown)**: ${total:,.2f}\n"
            return response

        elif tool_name == "find_anomalies":
            anomalies = result.get("anomalies", [])
            avg = result.get("average_transaction", 0)
            threshold = result.get("threshold", 0)
            if not anomalies:
                return f"No unusual transactions found. Your average transaction is ${avg:,.2f}."
            response = f"## Unusual Transactions\n\n"
            response += f"Average transaction: **${avg:,.2f}** — flagging anything above **${threshold:,.2f}** ({result.get('threshold', 0)/avg:.1f}x avg)\n\n"
            for a in anomalies:
                response += f"• **{a['date']}** | {a['description']} | **${a['amount']:,.2f}** ({a['times_above_avg']}x avg) — {a['category']}\n"
            return response

        elif tool_name == "net_savings_summary":
            period = result.get("period", "all time")
            income = result.get("total_income", 0)
            expenses = result.get("total_expenses", 0)
            net = result.get("net_savings", 0)
            rate = result.get("savings_rate_pct", 0)
            emoji = "🟢" if net >= 0 else "🔴"
            response = f"## Net Savings Summary ({period})\n\n"
            response += f"• **Income**: ${income:,.2f}\n"
            response += f"• **Expenses**: ${expenses:,.2f}\n"
            response += f"• **Net Savings**: {emoji} ${net:+,.2f}\n"
            if income > 0:
                response += f"• **Savings Rate**: {rate:.1f}%\n"
            return response

        elif tool_name == "biggest_transactions":
            txs = result.get("transactions", [])
            if not txs:
                return "No transactions found."
            response = f"## Largest Transactions\n\n"
            for i, t in enumerate(txs, 1):
                response += f"{i}. **{t['date']}** | {t['description']} | **${t['amount']:,.2f}** — {t['category']}\n"
            return response

        else:
            return f"Result: {json.dumps(result, indent=2, default=str)}"

# Singleton
_agent_service = None

def get_agent_service(gemini_api_key: str = None) -> FinanceAgentService:
    global _agent_service
    if _agent_service is None:
        _agent_service = FinanceAgentService(gemini_api_key)
    return _agent_service