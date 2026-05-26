import { useEffect, useState } from 'react'
import { useTransactionStore } from '../store/transactionStore'
import { dataService } from '../services/api'
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  PiggyBank,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

const insightIcons = {
  spending: TrendingDown,
  saving: PiggyBank,
  trend: TrendingUp,
  anomaly: AlertTriangle,
  recommendation: Lightbulb
}

const insightColors = {
  spending: 'bg-red-50 border-red-200 text-red-700',
  saving: 'bg-green-50 border-green-200 text-green-700',
  trend: 'bg-blue-50 border-blue-200 text-blue-700',
  anomaly: 'bg-orange-50 border-orange-200 text-orange-700',
  recommendation: 'bg-purple-50 border-purple-200 text-purple-700'
}

export default function Insights() {
  const { transactions, fetchTransactions } = useTransactionStore()
  const [insights, setInsights] = useState([])
  const [alerts, setAlerts] = useState([])
  const [savings, setSavings] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch transactions if not loaded
      if (transactions.length === 0) {
        await fetchTransactions()
      }
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (transactions.length > 0) {
      generateInsights()
    }
  }, [transactions])

  const generateInsights = async () => {
    if (transactions.length < 5) return

    setRefreshing(true)
    const formattedTx = transactions.map(t => ({
      date: t.date,
      description: t.description,
      amount: parseFloat(t.amount),
      type: t.type,
      category_id: t.category_id,
      category_name: t.category_name
    }))

    try {
      const [insightsRes, alertsRes, savingsRes] = await Promise.all([
        dataService.generateInsights(formattedTx),
        dataService.getSpendingAlerts(formattedTx),
        dataService.getSavingsOpportunities(formattedTx)
      ])

      setInsights(insightsRes.data.insights || [])
      setAlerts(alertsRes.data.alerts || [])
      setSavings(savingsRes.data.savings_opportunities || [])
    } catch (error) {
      console.error('Failed to generate insights:', error)
      toast.error('Failed to generate insights')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (transactions.length < 5) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-purple-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Not enough data yet</h2>
        <p className="text-gray-600">
          Upload more transactions to unlock AI-powered insights. We need at least 5 transactions to analyze patterns.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-gray-600">Personalized financial insights powered by AI</p>
        </div>
        <button
          onClick={generateInsights}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5" />
          )}
          Refresh
        </button>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Spending Alerts
          </h2>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  alert.severity === 'critical' ? 'bg-orange-50 border-orange-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                    alert.severity === 'warning' ? 'text-yellow-500' :
                    alert.severity === 'critical' ? 'text-orange-500' :
                    'text-red-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => {
              const Icon = insightIcons[insight.insight_type] || Lightbulb
              const colorClass = insightColors[insight.insight_type] || insightColors.recommendation
              
              return (
                <div
                  key={index}
                  className={`p-5 rounded-xl border ${colorClass}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/50 rounded-lg">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                      <p className="text-sm mt-1 text-gray-700">{insight.insight_text}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Savings Opportunities */}
      {savings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-green-500" />
            Savings Opportunities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savings.map((opp, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">{opp.category}</span>
                  <span className="text-lg font-bold text-green-600">
                    +${opp.potential_savings?.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{opp.suggestion}</p>
                {opp.transactions_count && (
                  <p className="text-xs text-gray-500 mt-2">
                    Based on {opp.transactions_count} transactions
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {insights.length === 0 && alerts.length === 0 && savings.length === 0 && !refreshing && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No insights available</h3>
          <p className="text-gray-500 mb-6">Click refresh to generate AI insights from your transaction data</p>
          <button
            onClick={generateInsights}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Generate Insights
          </button>
        </div>
      )}
    </div>
  )
}
