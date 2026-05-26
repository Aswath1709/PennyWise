import { useEffect, useState } from 'react'
import api, { dataService } from '../services/api'
import { 
  PiggyBank, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Budgets() {
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newBudget, setNewBudget] = useState({
    category_id: '',
    amount: '',
    period: 'monthly',
    alert_threshold: 80
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [budgetsRes, categoriesRes, alertsRes] = await Promise.all([
        api.get('/budgets'),
        dataService.getCategories(),
        api.get('/budgets/alerts/active')
      ])
      setBudgets(budgetsRes.data.budgets || [])
      setCategories(categoriesRes.data)
      setAlerts(alertsRes.data.alerts || [])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/budgets', {
        category_id: parseInt(newBudget.category_id),
        amount: parseFloat(newBudget.amount),
        period: newBudget.period,
        alert_threshold: parseFloat(newBudget.alert_threshold)
      })
      toast.success('Budget created!')
      setShowModal(false)
      setNewBudget({ category_id: '', amount: '', period: 'monthly', alert_threshold: 80 })
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create budget')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this budget?')) return
    
    try {
      await api.delete(`/budgets/${id}`)
      toast.success('Budget deleted')
      loadData()
    } catch (error) {
      toast.error('Failed to delete budget')
    }
  }

  const availableCategories = categories.filter(
    cat => !budgets.some(b => b.category_id === cat.id)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-gray-600">Track your spending limits by category</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={availableCategories.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Add Budget
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg flex items-start gap-3 ${
                alert.severity === 'over' ? 'bg-red-50 border border-red-200' :
                alert.severity === 'critical' ? 'bg-orange-50 border border-orange-200' :
                'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                alert.severity === 'over' ? 'text-red-500' :
                alert.severity === 'critical' ? 'text-orange-500' :
                'text-yellow-500'
              }`} />
              <div>
                <p className={`font-medium ${
                  alert.severity === 'over' ? 'text-red-800' :
                  alert.severity === 'critical' ? 'text-orange-800' :
                  'text-yellow-800'
                }`}>
                  {alert.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <PiggyBank className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets yet</h3>
          <p className="text-gray-500 mb-6">Create your first budget to start tracking spending limits</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => (
            <BudgetCard 
              key={budget.id} 
              budget={budget} 
              onDelete={() => handleDelete(budget.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Budget</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  required
                  value={newBudget.category_id}
                  onChange={(e) => setNewBudget({...newBudget, category_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="">Select category...</option>
                  {availableCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget Amount ($)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="500.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period
                </label>
                <select
                  value={newBudget.period}
                  onChange={(e) => setNewBudget({...newBudget, period: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={newBudget.alert_threshold}
                  onChange={(e) => setNewBudget({...newBudget, alert_threshold: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Get alerted when spending reaches this percentage</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Budget Card Component
function BudgetCard({ budget, onDelete }) {
  const percentage = Math.min(budget.percentage_used, 100)
  const isOverBudget = budget.is_over_budget
  const isWarning = budget.alert_triggered && !isOverBudget

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{budget.category_icon}</span>
            <h3 className="font-semibold text-gray-900">{budget.category_name}</h3>
          </div>
          <p className="text-sm text-gray-500 capitalize">{budget.period}</p>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverBudget ? 'bg-red-500' :
              isWarning ? 'bg-orange-500' :
              'bg-primary-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            ${budget.spent_amount?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-gray-500">
            of ${parseFloat(budget.amount).toFixed(2)} budget
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${
            isOverBudget ? 'text-red-600' :
            isWarning ? 'text-orange-600' :
            'text-green-600'
          }`}>
            {percentage.toFixed(0)}%
          </p>
          <p className={`text-sm ${
            isOverBudget ? 'text-red-500' : 'text-gray-500'
          }`}>
            {isOverBudget 
              ? `$${Math.abs(budget.remaining).toFixed(2)} over` 
              : `$${budget.remaining?.toFixed(2) || '0.00'} left`
            }
          </p>
        </div>
      </div>
    </div>
  )
}
