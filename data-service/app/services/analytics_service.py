import os
import uuid
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from typing import List, Dict, Any, Optional

# ==========================================
# 1. Native Gemini Tools Definitions
# ==========================================

def aggregate(category: Optional[str], income_only: Optional[bool], expenses_only: Optional[bool]):
    """Use this for ANY math, totals, sums, or averages."""
    pass

def create_chart(chart_type: Optional[str], group_by: Optional[str], title: Optional[str]):
    """Use when the user explicitly asks for a visual, graph, or chart."""
    pass

# UPDATED: Added transaction_type parameter to the tool definition
def query_transactions(category: Optional[str], search_term: Optional[str], transaction_type: Optional[str]):
    """
    Use ONLY to search for specific lists of transactions.
    Set transaction_type to 'credit' for received money/income.
    Set transaction_type to 'debit' for spending/expenses.
    """
    pass
    
def find_recurring(min_occurrences: Optional[int]):
    """Find recurring charges and subscriptions."""
    pass

def compare_periods(
    period1: str,
    period2: str,
    chart_type: Optional[str],
    show_chart: Optional[bool]
):
    """
    Compare total spending between two time periods (e.g., months or date ranges).
    Use when the user asks to compare spending across different months or time periods.
    - period1: First period label, e.g. 'October 2024' or '2024-10'
    - period2: Second period label, e.g. 'November 2024' or '2024-11'
    - chart_type: 'bar' (default) or 'pie'
    - show_chart: Whether to generate a chart (default True)
    """
    pass

def category_breakdown_by_period(
    period1: str,
    period2: Optional[str],
    chart_type: Optional[str],
    show_chart: Optional[bool]
):
    """
    Show spending broken down by category for one or two time periods.
    Use when the user asks how much was spent on each category in a specific month,
    or wants to compare category spending across two months.
    - period1: First period, e.g. 'October 2024' or '2024-10'
    - period2: Optional second period for side-by-side comparison
    - chart_type: 'bar' (default, grouped) or 'pie'
    - show_chart: Whether to generate a chart (default True)
    """
    pass

def spending_trend(category: Optional[str], chart_type: Optional[str], show_chart: Optional[bool]):
    """
    Show monthly spending trend over time with a chart.
    Use when user asks about spending over time, monthly trends, how spending has changed,
    or wants to see a month-by-month breakdown.
    - category: Optional category filter (e.g. 'groceries', 'dining')
    - chart_type: 'bar' (default) or 'line'
    - show_chart: Whether to generate a chart (default True)
    """
    pass

def top_merchants(limit: Optional[int], show_chart: Optional[bool]):
    """
    Find the top merchants or vendors by total spending with a horizontal bar chart.
    Use when user asks where they spend the most, top vendors, biggest merchants,
    or which stores/services cost the most.
    - limit: Number of top merchants to show (default 10)
    - show_chart: Whether to generate a chart (default True)
    """
    pass

def find_anomalies(threshold_multiplier: Optional[float], limit: Optional[int]):
    """
    Find unusual or anomalous transactions that are significantly larger than the user's average.
    Use when user asks about unusual spending, outliers, large transactions,
    suspicious charges, or anything that seems out of the ordinary.
    - threshold_multiplier: Flag transactions above this multiple of the average (default 2.0x)
    - limit: Maximum number of anomalies to return (default 10)
    """
    pass

def net_savings_summary(period: Optional[str]):
    """
    Calculate net savings (total income minus total expenses) with a summary breakdown.
    Use when user asks about savings, net income, how much money is left over,
    income vs expenses, or financial health summary.
    - period: Optional month filter, e.g., 'October 2024'. Omit for all-time.
    """
    pass

def biggest_transactions(limit: Optional[int], transaction_type: Optional[str], category: Optional[str]):
    """
    Find the largest individual transactions by amount.
    Use when user asks about biggest expenses, most expensive purchases, largest transactions,
    or where the most money went in a single transaction.
    - limit: Number of transactions to return (default 10)
    - transaction_type: 'debit' for expenses (default), 'credit' for income
    - category: Optional category filter
    """
    pass

def get_gemini_tools():
    """Returns all available tools for the Gemini agent."""
    return [
        aggregate, create_chart, query_transactions, find_recurring,
        compare_periods, category_breakdown_by_period,
        spending_trend, top_merchants, find_anomalies,
        net_savings_summary, biggest_transactions,
    ]
# ==========================================
# 2. Analytics Service Base & Finance Tools
# ==========================================

class AnalyticsService:
    def __init__(self):
        self.df = pd.DataFrame()

    def load_transactions(self, transactions: List[Dict]):
        if transactions:
            self.df = pd.DataFrame(transactions)
            
            # THE SYMBOL CRUSHER: Fixes the -$-1.70 and $7,000 errors
            if 'amount' in self.df.columns:
                self.df['amount'] = (
                    self.df['amount']
                    .astype(str)
                    .str.replace(r'[^\d.-]', '', regex=True) # Strips $, letters, etc.
                    .pipe(pd.to_numeric, errors='coerce')
                    .fillna(0)
                )
            
            # Robust date parsing: try multiple formats common in bank statements
            def _parse_dates(series):
                formats = [
                    '%Y-%m-%d',      # 2024-11-01
                    '%m/%d/%Y',      # 11/01/2024
                    '%m/%d/%y',      # 11/01/24
                    '%d/%m/%Y',      # 01/11/2024
                    '%b %d, %Y',     # Nov 01, 2024
                    '%B %d, %Y',     # November 01, 2024
                    '%b %d %Y',      # Nov 01 2024
                    '%d %b %Y',      # 01 Nov 2024
                    '%m-%d-%Y',      # 11-01-2024
                ]
                result = pd.to_datetime(series, infer_datetime_format=True, errors='coerce')
                # For any NaT, try explicit formats
                nat_mask = result.isna()
                if nat_mask.any():
                    for fmt in formats:
                        try:
                            fixed = pd.to_datetime(series[nat_mask], format=fmt, errors='coerce')
                            result[nat_mask] = fixed
                            nat_mask = result.isna()
                            if not nat_mask.any():
                                break
                        except Exception:
                            continue
                return result

            self.df['date'] = _parse_dates(self.df['date'])
            
            if 'category' not in self.df.columns:
                # Use category_name from JSON if category is missing
                self.df['category'] = self.df.get('category_name', self.df.get('category', 'other'))
            
            # Fill any NaN categories
            self.df['category'] = self.df['category'].fillna('other')

class FinanceTools(AnalyticsService):
    def __init__(self, transactions: List[Dict]):
        super().__init__()
        self.load_transactions(transactions)

    def execute(self, tool_name: str, params: Dict) -> Dict:
        method = getattr(self, tool_name, None)
        if method:
            return method(**params)
        return {"error": f"Tool {tool_name} not found"}

    # UPDATED: Added transaction_type filter logic
    def query_transactions(self, category=None, search_term=None, transaction_type=None, **kwargs):
        if self.df.empty: return {"transactions": []}
        df = self.df.copy()
        
        # Filter by type (credit = income, debit = expense)
        if transaction_type == 'credit':
            df = df[df['amount'] > 0]
        elif transaction_type == 'debit':
            df = df[df['amount'] < 0]

        if category:
            df = df[df['category'].str.lower() == category.lower()]
            
        if search_term:
            df = df[df['description'].str.contains(search_term, case=False, na=False)]
            
        txs = df.head(20).to_dict('records')
        for t in txs:
            if isinstance(t['date'], pd.Timestamp):
                t['date'] = t['date'].strftime('%Y-%m-%d')
            # Ensure amount is returned as a clean float
            t['amount'] = float(t['amount'])
            
        return {"transactions": txs}

    def aggregate(self, category=None, income_only=False, expenses_only=False, **kwargs):
        if self.df.empty: return {"total": 0, "results": {}}
        df = self.df.copy()
        
        if income_only:
            df = df[df['amount'] > 0]
        elif expenses_only:
            df = df[df['amount'] < 0]
            
        if category:
            df = df[df['category'].str.lower() == category.lower()]
            return {"value": float(df['amount'].abs().sum())}
            
        results = df.groupby('category')['amount'].sum().abs().to_dict()
        total = sum(results.values())
        return {"total": float(total), "results": results}

    # ... rest of your methods (create_chart, find_recurring, etc.) stay the same

    def create_chart(self, chart_type="pie", group_by="category", title=None, **kwargs):
        if self.df.empty: return {"error": "No data available to chart."}
        expenses = self.df[self.df['amount'] < 0]
        if expenses.empty: return {"error": "No expense data available to chart."}
        
        data = expenses.groupby('category')['amount'].sum().abs().to_dict()
        
        plt.figure(figsize=(8, 6))
        if chart_type == "pie":
            plt.pie(data.values(), labels=data.keys(), autopct='%1.1f%%', startangle=140)
        else:
            plt.bar(data.keys(), data.values(), color='#3b82f6')
            plt.xticks(rotation=45, ha='right')
            plt.ylabel('Amount ($)')
        
        if title: plt.title(title)
        plt.tight_layout()
            
        os.makedirs('/tmp/pennywise_charts', exist_ok=True)
        path = f"/tmp/pennywise_charts/chart_{uuid.uuid4().hex}.png"
        plt.savefig(path, format='png', dpi=150)
        plt.close()
            
        return {
            "chart_created": True,
            "chart_path": path,
            "chart_type": chart_type,
            "total": sum(data.values()),
            "data": data
        }

    def find_recurring(self, min_occurrences=2, **kwargs):
        if self.df.empty: return {"recurring_charges": []}
        expenses = self.df[self.df['amount'] < 0]
        counts = expenses['description'].value_counts()
        recurring = counts[counts >= min_occurrences].index
        
        res = []
        for r in recurring:
            subset = expenses[expenses['description'] == r]
            res.append({
                "description": r,
                "avg_amount": float(subset['amount'].abs().mean()),
                "occurrences": int(len(subset))
            })
        return {"recurring_charges": res}

    def _parse_period(self, period_str: str):
        """Parse a period string like 'October 2024' or '2024-10' into (year, month) tuple."""
        import re
        period_str = period_str.strip()
        # Try YYYY-MM
        m = re.match(r'(\d{4})-(\d{1,2})', period_str)
        if m:
            return int(m.group(1)), int(m.group(2))
        # Try 'Month YYYY'
        try:
            from datetime import datetime
            dt = datetime.strptime(period_str, '%B %Y')
            return dt.year, dt.month
        except ValueError:
            pass
        # Try 'Mon YYYY'
        try:
            from datetime import datetime
            dt = datetime.strptime(period_str, '%b %Y')
            return dt.year, dt.month
        except ValueError:
            pass
        return None, None

    def _filter_by_period(self, df, year, month):
        """Filter dataframe to a specific year/month."""
        if year is None:
            return df
        mask = (df['date'].dt.year == year) & (df['date'].dt.month == month)
        return df[mask]

    def compare_periods(self, period1: str, period2: str,
                        chart_type: str = "bar", show_chart: bool = True, **kwargs):
        """Compare total spending between two time periods with optional bar chart."""
        if self.df.empty:
            return {"error": "No transaction data available."}

        y1, m1 = self._parse_period(period1)
        y2, m2 = self._parse_period(period2)

        if y1 is None or y2 is None:
            return {"error": f"Could not parse periods: '{period1}', '{period2}'"}

        expenses = self.df[self.df['amount'] < 0].copy()
        df1 = self._filter_by_period(expenses, y1, m1)
        df2 = self._filter_by_period(expenses, y2, m2)

        total1 = float(df1['amount'].abs().sum())
        total2 = float(df2['amount'].abs().sum())

        result = {
            "period1": period1,
            "period2": period2,
            "period1_total": total1,
            "period2_total": total2,
            "difference": round(total2 - total1, 2),
            "pct_change": round(((total2 / total1) - 1) * 100, 1) if total1 > 0 else 0
        }

        if show_chart:
            fig, ax = plt.subplots(figsize=(7, 5))
            colors = ['#6366f1', '#f59e0b']
            bars = ax.bar([period1, period2], [total1, total2], color=colors, width=0.45)
            for bar, val in zip(bars, [total1, total2]):
                ax.text(bar.get_x() + bar.get_width() / 2,
                        bar.get_height() + max(total1, total2) * 0.01,
                        f'${val:,.0f}', ha='center', va='bottom', fontweight='bold', fontsize=11)
            ax.set_title(f'Spending: {period1} vs {period2}', fontsize=13, fontweight='bold')
            ax.set_ylabel('Total Spending ($)')
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x:,.0f}'))
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            plt.tight_layout()

            os.makedirs('/tmp/pennywise_charts', exist_ok=True)
            path = f"/tmp/pennywise_charts/chart_{uuid.uuid4().hex}.png"
            plt.savefig(path, dpi=150)
            plt.close()
            result['chart_created'] = True
            result['chart_path'] = path

        return result

    def category_breakdown_by_period(self, period1: str, period2: str = None,
                                      chart_type: str = "bar", show_chart: bool = True, **kwargs):
        """Per-category spending for one or two periods with optional grouped bar chart."""
        if self.df.empty:
            return {"error": "No transaction data available."}

        y1, m1 = self._parse_period(period1)
        if y1 is None:
            return {"error": f"Could not parse period: '{period1}'"}

        expenses = self.df[self.df['amount'] < 0].copy()
        df1 = self._filter_by_period(expenses, y1, m1)
        cats1 = df1.groupby('category')['amount'].sum().abs().to_dict()

        result = {
            "period1": period1,
            "period1_categories": {k: round(float(v), 2) for k, v in cats1.items()},
        }

        cats2 = {}
        if period2:
            y2, m2 = self._parse_period(period2)
            if y2 is not None:
                df2 = self._filter_by_period(expenses, y2, m2)
                cats2 = df2.groupby('category')['amount'].sum().abs().to_dict()
                result['period2'] = period2
                result['period2_categories'] = {k: round(float(v), 2) for k, v in cats2.items()}

        if show_chart:
            all_cats = sorted(set(list(cats1.keys()) + list(cats2.keys())))
            if not all_cats:
                result['chart_created'] = False
                return result

            x = range(len(all_cats))
            fig, ax = plt.subplots(figsize=(max(9, len(all_cats) * 1.2), 6))

            if cats2:
                width = 0.38
                bars1 = ax.bar([i - width / 2 for i in x],
                               [cats1.get(c, 0) for c in all_cats],
                               width, label=period1, color='#6366f1')
                bars2 = ax.bar([i + width / 2 for i in x],
                               [cats2.get(c, 0) for c in all_cats],
                               width, label=period2, color='#f59e0b')
                ax.legend(fontsize=10)
                ax.set_title(f'Category Spending: {period1} vs {period2}',
                             fontsize=13, fontweight='bold')
            else:
                ax.bar(x, [cats1.get(c, 0) for c in all_cats], color='#6366f1')
                ax.set_title(f'Category Spending: {period1}', fontsize=13, fontweight='bold')

            ax.set_xticks(list(x))
            ax.set_xticklabels(all_cats, rotation=35, ha='right', fontsize=9)
            ax.set_ylabel('Amount ($)')
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f'${v:,.0f}'))
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            plt.tight_layout()

            os.makedirs('/tmp/pennywise_charts', exist_ok=True)
            path = f"/tmp/pennywise_charts/chart_{uuid.uuid4().hex}.png"
            plt.savefig(path, dpi=150)
            plt.close()
            result['chart_created'] = True
            result['chart_path'] = path

        return result

    # ── New proactive tools ────────────────────────────────────────────────

    def spending_trend(self, category=None, chart_type="bar", show_chart=True, **kwargs):
        """Monthly spending trend, optionally filtered to one category."""
        if self.df.empty:
            return {"error": "No transaction data available."}

        df = self.df[self.df['amount'] < 0].copy()
        if category:
            df = df[df['category'].str.lower() == category.lower()]
        if df.empty:
            return {"error": f"No expense data found{' for ' + category if category else ''}."}

        df = df.copy()
        df['month'] = df['date'].dt.to_period('M')
        monthly = df.groupby('month')['amount'].sum().abs().sort_index()
        data = {str(k): round(float(v), 2) for k, v in monthly.items()}
        avg = round(float(monthly.mean()), 2)
        result = {"months": data, "average_monthly": avg, "category": category}

        if show_chart and data:
            import numpy as _np
            fig, ax = plt.subplots(figsize=(max(8, len(data) * 0.9), 5))
            months_list = list(data.keys())
            values = list(data.values())
            ax.bar(months_list, values, color='#6366f1', alpha=0.85)
            ax.axhline(avg, color='#ef4444', linestyle='--', linewidth=1.5,
                       label=f'Avg ${avg:,.0f}/mo')
            for i, v in enumerate(values):
                ax.text(i, v + avg * 0.015, f'${v:,.0f}',
                        ha='center', va='bottom', fontsize=8, fontweight='bold')
            title = f'Monthly Spending{" — " + category.title() if category else ""}'
            ax.set_title(title, fontsize=13, fontweight='bold')
            ax.set_ylabel('Amount ($)')
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x:,.0f}'))
            ax.tick_params(axis='x', rotation=35)
            ax.legend()
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            plt.tight_layout()
            os.makedirs('/tmp/pennywise_charts', exist_ok=True)
            path = f"/tmp/pennywise_charts/chart_{uuid.uuid4().hex}.png"
            plt.savefig(path, dpi=150)
            plt.close()
            result['chart_created'] = True
            result['chart_path'] = path

        return result

    def top_merchants(self, limit=10, show_chart=True, **kwargs):
        """Top merchants/vendors by total spending with horizontal bar chart."""
        if self.df.empty:
            return {"error": "No transaction data available."}
        expenses = self.df[self.df['amount'] < 0].copy()
        if expenses.empty:
            return {"error": "No expense data found."}

        top = expenses.groupby('description')['amount'].sum().abs()
        top = top.sort_values(ascending=False).head(limit)
        merchants = {k: round(float(v), 2) for k, v in top.items()}
        result = {"merchants": merchants, "total_shown": round(float(top.sum()), 2)}

        if show_chart and merchants:
            import numpy as _np
            names = list(merchants.keys())
            values = list(merchants.values())
            short_names = [n[:38] + '…' if len(n) > 38 else n for n in names]
            fig, ax = plt.subplots(figsize=(10, max(5, len(names) * 0.55)))
            colors = plt.cm.Blues_r(_np.linspace(0.3, 0.85, len(names)))
            ax.barh(short_names[::-1], values[::-1], color=colors)
            max_val = max(values)
            for i, v in enumerate(values[::-1]):
                ax.text(v + max_val * 0.01, i, f'${v:,.0f}', va='center', fontsize=9)
            ax.set_title(f'Top {len(names)} Merchants by Spending', fontsize=13, fontweight='bold')
            ax.set_xlabel('Amount ($)')
            ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x:,.0f}'))
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            plt.tight_layout()
            os.makedirs('/tmp/pennywise_charts', exist_ok=True)
            path = f"/tmp/pennywise_charts/chart_{uuid.uuid4().hex}.png"
            plt.savefig(path, dpi=150)
            plt.close()
            result['chart_created'] = True
            result['chart_path'] = path

        return result

    def find_anomalies(self, threshold_multiplier=2.0, limit=10, **kwargs):
        """Find unusually large transactions relative to the user's average."""
        if self.df.empty:
            return {"error": "No transaction data available."}
        expenses = self.df[self.df['amount'] < 0].copy()
        if expenses.empty:
            return {"anomalies": [], "average_transaction": 0, "threshold": 0}

        mean_spend = float(expenses['amount'].abs().mean())
        threshold = mean_spend * float(threshold_multiplier)
        flagged = expenses[expenses['amount'].abs() > threshold].copy()
        flagged = flagged.sort_values('amount').head(limit)

        result_list = []
        for _, row in flagged.iterrows():
            date_str = row['date'].strftime('%Y-%m-%d') if isinstance(row['date'], pd.Timestamp) else str(row['date'])
            result_list.append({
                "date": date_str,
                "description": row['description'],
                "amount": round(float(abs(row['amount'])), 2),
                "category": row.get('category', 'other'),
                "times_above_avg": round(float(abs(row['amount'])) / mean_spend, 1)
            })

        return {
            "anomalies": result_list,
            "average_transaction": round(mean_spend, 2),
            "threshold": round(threshold, 2)
        }

    def net_savings_summary(self, period=None, **kwargs):
        """Income vs expenses and net savings for all time or a specific period."""
        if self.df.empty:
            return {"error": "No transaction data available."}
        df = self.df.copy()
        if period:
            y, m = self._parse_period(period)
            if y:
                df = self._filter_by_period(df, y, m)

        income = float(df[df['amount'] > 0]['amount'].sum())
        expenses = float(df[df['amount'] < 0]['amount'].abs().sum())
        net = income - expenses
        savings_rate = (net / income * 100) if income > 0 else 0

        return {
            "period": period or "all time",
            "total_income": round(income, 2),
            "total_expenses": round(expenses, 2),
            "net_savings": round(net, 2),
            "savings_rate_pct": round(savings_rate, 1)
        }

    def biggest_transactions(self, limit=10, transaction_type="debit", category=None, **kwargs):
        """Return the N largest individual transactions."""
        if self.df.empty:
            return {"error": "No transaction data available."}
        df = self.df.copy()
        if transaction_type == "debit":
            df = df[df['amount'] < 0]
        elif transaction_type == "credit":
            df = df[df['amount'] > 0]
        if category:
            df = df[df['category'].str.lower() == category.lower()]

        df = df.copy()
        df['abs_amount'] = df['amount'].abs()
        df = df.sort_values('abs_amount', ascending=False).head(limit)

        txs = []
        for _, row in df.iterrows():
            date_str = row['date'].strftime('%Y-%m-%d') if isinstance(row['date'], pd.Timestamp) else str(row['date'])
            txs.append({
                "date": date_str,
                "description": row['description'],
                "amount": round(float(abs(row['amount'])), 2),
                "category": row.get('category', 'other')
            })

        return {"transactions": txs, "count": len(txs)}

    def get_data_summary(self):
        """Calculates based strictly on positive/negative signs."""
        if self.df.empty:
            return {"total_spent": 0, "total_income": 0, "count": 0}
        
        # Strictly positive = Income
        income_df = self.df[self.df['amount'] > 0]
        total_income = income_df['amount'].sum()
        
        # Strictly negative = Spending
        spending_df = self.df[self.df['amount'] < 0]
        total_spent = spending_df['amount'].abs().sum()
        
        return {
            "total_spent": round(float(total_spent), 2),
            "total_income": round(float(total_income), 2),
            "count": len(self.df)
        }

    def get_statistics(self):
        """Standard dashboard statistics."""
        summary = self.get_data_summary()
        summary["net_savings"] = round(summary["total_income"] - summary["total_spent"], 2)
        return summary

    def get_spending_by_category(self):
        """Groups spending by category for the pie chart."""
        if self.df.empty:
            return []
        
        expenses = self.df[self.df['amount'] < 0]
        category_totals = expenses.groupby('category')['amount'].sum().abs()
        
        return [
            {"category_name": k, "total_amount": round(float(v), 2)} 
            for k, v in category_totals.to_dict().items()
        ]

    def get_monthly_spending(self):
        """Groups spending by month for the trend chart."""
        if self.df.empty:
            return []
        
        # Ensure we have a Month-Year column
        df = self.df.copy()
        df['month'] = df['date'].dt.strftime('%b %Y')
        
        income = df[df['amount'] > 0].groupby('month')['amount'].sum()
        spending = df[df['amount'] < 0].groupby('month')['amount'].sum().abs()
        
        # Sort months chronologically by creating a sort key
        months = list(set(income.index) | set(spending.index))
        months.sort(key=lambda m: pd.to_datetime(m, format='%b %Y'))
        
        return [
            {
                "month": m, 
                "total_income": round(float(income.get(m, 0)), 2),
                "total_spending": round(float(spending.get(m, 0)), 2)
            } 
            for m in months
        ]

    def get_top_merchants(self, limit=10):
        """Finds the descriptions with the highest total spend."""
        if self.df.empty:
            return []
            
        top = self.df[self.df['amount'] < 0].groupby('description')['amount'].sum().abs()
        top = top.sort_values(ascending=False).head(limit)
        
        return [
            {"merchant": k, "amount": round(float(v), 2)} 
            for k, v in top.to_dict().items()
        ]