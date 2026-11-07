import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactionStore } from '../store/transactionStore'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard,
  ArrowRight,
  Upload,
  Loader2,
  Activity
} from 'lucide-react'
import { 
  PieChart, Pie, Cell, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const monthKey = (date) => String(date || '').slice(0, 7) // 'YYYY-MM'
const monthLabel = (key, style = 'long') => {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: style, year: 'numeric' })
}
const absAmount = (tx) => Math.abs(parseFloat(tx.amount) || 0)

export default function Dashboard() {
  const { transactions, accounts, fetchTransactions, fetchAccounts } = useTransactionStore()
  const { token, isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      // Ensure token is set in API headers before fetching
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }
      await Promise.all([
        fetchTransactions(),
        fetchAccounts()
      ])
      setLoading(false)
    }
    
    // Only fetch if authenticated
    if (isAuthenticated && token) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, token])

  // Months that have data, newest first
  const months = useMemo(() => {
    const keys = new Set(transactions.map(t => monthKey(t.date)).filter(Boolean))
    return [...keys].sort().reverse()
  }, [transactions])

  // Default to the latest month with data; reset if that month disappears
  useEffect(() => {
    if (months.length && (!selectedMonth || !months.includes(selectedMonth))) {
      setSelectedMonth(months[0])
    }
  }, [months, selectedMonth])

  const activeMonth = selectedMonth || months[0]

  // Stats, category breakdown and recent transactions for the selected month
  const monthData = useMemo(() => {
    const monthTx = transactions.filter(t => monthKey(t.date) === activeMonth)
    let spending = 0
    let income = 0
    const byCategory = {}
    for (const t of monthTx) {
      const amt = absAmount(t)
      if (t.type === 'credit') {
        income += amt
      } else {
        spending += amt
        const cat = t.category_name || 'Uncategorized'
        byCategory[cat] = (byCategory[cat] || 0) + amt
      }
    }
    const spendingByCategory = Object.entries(byCategory)
      .map(([category_name, total_amount]) => ({ category_name, total_amount }))
      .sort((a, b) => b.total_amount - a.total_amount)
    const accountIds = new Set(monthTx.map(t => t.bank_account_id).filter(Boolean))
    return { monthTx, spending, income, spendingByCategory, accountCount: accountIds.size }
  }, [transactions, activeMonth])

  // Trend across all months (oldest first)
  const monthlyTrend = useMemo(() => {
    const byMonth = {}
    for (const t of transactions) {
      const k = monthKey(t.date)
      if (!k) continue
      byMonth[k] = byMonth[k] || { total_income: 0, total_spending: 0 }
      if (t.type === 'credit') byMonth[k].total_income += absAmount(t)
      else byMonth[k].total_spending += absAmount(t)
    }
    return Object.keys(byMonth).sort().map(k => ({
      key: k,
      month: monthLabel(k, 'short'),
      total_income: Math.round(byMonth[k].total_income * 100) / 100,
      total_spending: Math.round(byMonth[k].total_spending * 100) / 100
    }))
  }, [transactions])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Upload className="w-10 h-10 text-primary-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to PennyWise!</h2>
        <p className="text-gray-600 mb-8">
          Upload your first bank statement to start tracking your finances with AI-powered insights.
        </p>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Upload Statement
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    )
  }

  const stats = {
    total_spending: monthData.spending,
    total_income: monthData.income,
    total_transactions: monthData.monthTx.length
  }
  const spendingByCategory = monthData.spendingByCategory
  const activeLabel = activeMonth ? monthLabel(activeMonth) : ''
  const shortLabel = activeMonth ? monthLabel(activeMonth, 'short') : ''

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            {activeMonth === months[0] ? 'Your latest month' : 'Overview'}: <span className="font-medium text-gray-900">{activeLabel}</span>
          </p>
        </div>
        <select
          value={activeMonth || ''}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Select month"
        >
          {months.map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Spending"
          value={stats.total_spending || 0}
          icon={TrendingDown}
          color="text-red-500"
          bgColor="bg-red-50"
        />
        <StatCard
          title="Income"
          value={stats.total_income || 0}
          icon={TrendingUp}
          color="text-green-500"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Net"
          value={(stats.total_income || 0) - (stats.total_spending || 0)}
          signed
          icon={DollarSign}
          color="text-blue-500"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Transactions"
          value={stats.total_transactions || 0}
          icon={Activity}
          color="text-blue-500"
          bgColor="bg-blue-50"
          isCurrency={false}
        />
        <StatCard
          title="Accounts"
          value={monthData.accountCount || accounts.length}
          icon={CreditCard}
          color="text-purple-500"
          bgColor="bg-purple-50"
          isCurrency={false}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category · {shortLabel}</h3>
          {spendingByCategory.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendingByCategory}
                    dataKey="total_amount"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {spendingByCategory.map((entry, index) => (
                      <Cell key={entry.category_name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `$${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No spending data yet
            </div>
          )}
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {spendingByCategory.slice(0, 6).map((cat, index) => (
              <div key={cat.category_name} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-gray-600">{cat.category_name} · ${cat.total_amount.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Monthly Trend</h3>
          <p className="text-xs text-gray-500 mb-3">All months · click a month to view it</p>
          {monthlyTrend.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyTrend}
                  onClick={(e) => {
                    const key = e?.activePayload?.[0]?.payload?.key
                    if (key) setSelectedMonth(key)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip 
                    formatter={(value) => `$${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total_income" 
                    stroke="#22c55e" 
                    fillOpacity={1} 
                    fill="url(#colorIncome)"
                    name="Income"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total_spending" 
                    stroke="#ef4444" 
                    fillOpacity={1} 
                    fill="url(#colorSpending)"
                    name="Spending"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No monthly data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions · {shortLabel}</h3>
          <Link to="/transactions" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {monthData.monthTx.slice(0, 5).map((tx) => (
            <div key={tx.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{tx.description}</p>
                <p className="text-sm text-gray-500">{tx.category_name || 'Uncategorized'} • {tx.date}</p>
              </div>
              <span className={`font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                {tx.type === 'credit' ? '+' : '-'}${absAmount(tx).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, bgColor, isCurrency = true, signed = false }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {isCurrency
              ? `${signed && value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : value}
          </p>
        </div>
        <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  )
}