import { useEffect, useState, useMemo } from 'react'
import { useTransactionStore } from '../store/transactionStore'
import { dataService } from '../services/api'
import { 
  Search, 
  Filter, 
  ChevronDown,
  Loader2,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Calendar,
  Tag
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Delete Transactions Modal ──────────────────────────────────────────────
const CONFIRM_PHRASE_ALL      = 'delete all transactions'
const CONFIRM_PHRASE_FILTERED = 'delete transactions'

function DeleteTransactionsModal({ categories, transactions, onClose, onDeleted }) {
  const { bulkDeleteTransactions } = useTransactionStore()

  const [startDate, setStartDate]       = useState('')
  const [endDate, setEndDate]           = useState('')
  const [delCategory, setDelCategory]   = useState('')
  const [isDeleting, setIsDeleting]     = useState(false)
  const [confirmText, setConfirmText]   = useState('')

  const parseAmount = (val) => {
    if (typeof val === 'number') return val
    return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0
  }

  const hasFilter = startDate || endDate || delCategory

  const matchingTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = tx.date ? new Date(tx.date) : null
      const start  = startDate ? new Date(startDate) : null
      const end    = endDate   ? new Date(endDate)   : null
      if (start && txDate && txDate < start) return false
      if (end   && txDate && txDate > end)   return false
      if (delCategory && tx.category_id !== parseInt(delCategory)) return false
      return true
    })
  }, [transactions, startDate, endDate, delCategory])

  // "Delete All" mode = no filters active
  const isDeleteAll    = !hasFilter
  const confirmPhrase  = isDeleteAll ? CONFIRM_PHRASE_ALL : CONFIRM_PHRASE_FILTERED
  const canDelete      = confirmText.trim().toLowerCase() === confirmPhrase
                         && matchingTransactions.length > 0

  const handleDelete = async () => {
    if (!canDelete) return
    setIsDeleting(true)
    const ids = matchingTransactions.map(t => t.id)
    const result = await bulkDeleteTransactions(ids)
    setIsDeleting(false)
    if (result.success) {
      toast.success(`Deleted ${result.count} transaction${result.count !== 1 ? 's' : ''}`)
      onDeleted()
      onClose()
    } else {
      toast.error(result.error)
    }
  }

  const totalAmount = matchingTransactions
    .filter(t => t.type === 'debit')
    .reduce((s, t) => s + Math.abs(parseAmount(t.amount)), 0)

  // Reset confirmation whenever filters change
  const resetConfirm = () => setConfirmText('')

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up"
          style={{ animation: 'slideUp 0.25s ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDeleteAll ? 'bg-red-100' : 'bg-orange-100'}`}>
                <Trash2 className={`w-5 h-5 ${isDeleteAll ? 'text-red-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Delete Transactions</h2>
                <p className="text-xs text-gray-500">
                  {isDeleteAll
                    ? 'No filters set — this will delete ALL transactions'
                    : 'Filter transactions to delete in bulk'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Date Range */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                Date Range
                <span className="ml-auto text-xs font-normal text-gray-400">optional</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); resetConfirm() }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); resetConfirm() }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Tag className="w-4 h-4 text-gray-400" />
                Category
                <span className="ml-auto text-xs font-normal text-gray-400">optional</span>
              </label>
              <div className="relative">
                <select
                  value={delCategory}
                  onChange={e => { setDelCategory(e.target.value); resetConfirm() }}
                  className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none appearance-none bg-white"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Preview / Confirmation area */}
            {isDeleteAll ? (
              /* ── Delete All: type-to-confirm ── */
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      This will permanently delete all {transactions.length} transactions
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      This action <strong>cannot be undone</strong>. All your financial history will be lost.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1.5">
                    To confirm, type{' '}
                    <code className="bg-red-100 border border-red-200 rounded px-1 py-0.5 font-mono text-red-800">
                      {CONFIRM_PHRASE_ALL}
                    </code>
                    {' '}below
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_PHRASE_ALL}
                    autoFocus
                    className={`w-full border-2 rounded-lg px-3 py-2.5 text-sm outline-none font-mono transition-colors ${
                      confirmText.trim().toLowerCase() === CONFIRM_PHRASE_ALL
                        ? 'border-red-500 bg-white text-red-700'
                        : 'border-gray-300 bg-white text-gray-700 focus:border-red-400'
                    }`}
                  />
                </div>
              </div>
            ) : (
              /* ── Filtered delete: preview list ── */
              <div className={`rounded-xl border-2 p-4 transition-colors ${
                matchingTransactions.length > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-100 bg-gray-50'
              }`}>
                {matchingTransactions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center">
                    No transactions match the selected filters.
                  </p>
                  ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-sm font-semibold text-red-700">
                        {matchingTransactions.length} transaction{matchingTransactions.length !== 1 ? 's' : ''} will be permanently deleted
                      </p>
                    </div>
                    <ul className="space-y-1 mb-3 max-h-28 overflow-y-auto pr-1">
                      {matchingTransactions.slice(0, 5).map(tx => (
                        <li key={tx.id} className="flex justify-between text-xs text-gray-700">
                          <span className="truncate max-w-[200px]">{tx.description}</span>
                          <span className={tx.type === 'credit' ? 'text-green-600 font-medium' : 'text-gray-700 font-medium'}>
                            {tx.type === 'credit' ? '+' : '-'}${Math.abs(parseAmount(tx.amount)).toFixed(2)}
                          </span>
                        </li>
                      ))}
                      {matchingTransactions.length > 5 && (
                        <li className="text-xs text-gray-400 italic">
                          …and {matchingTransactions.length - 5} more
                        </li>
                      )}
                    </ul>
                    <p className="text-xs text-gray-500 mb-3">
                      Total spending: <strong className="text-red-600">${totalAmount.toFixed(2)}</strong>
                    </p>
                    {/* Type-to-confirm for filtered delete */}
                    <label className="block text-xs font-semibold text-red-700 mb-1.5">
                      To confirm, type{' '}
                      <code className="bg-red-100 border border-red-200 rounded px-1 py-0.5 font-mono text-red-800">
                        {CONFIRM_PHRASE_FILTERED}
                      </code>
                      {' '}below
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      placeholder={CONFIRM_PHRASE_FILTERED}
                      className={`w-full border-2 rounded-lg px-3 py-2.5 text-sm outline-none font-mono transition-colors ${
                        confirmText.trim().toLowerCase() === CONFIRM_PHRASE_FILTERED
                          ? 'border-red-500 bg-white text-red-700'
                          : 'border-gray-300 bg-white text-gray-700 focus:border-red-400'
                      }`}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold
                         hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
              ) : isDeleteAll ? (
                <><Trash2 className="w-4 h-4" /> Delete All {transactions.length} Transactions</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Delete {matchingTransactions.length} Transaction{matchingTransactions.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Transactions Page ─────────────────────────────────────────────────
export default function Transactions() {
  const { transactions, accounts, fetchTransactions, fetchAccounts, updateTransaction, deleteTransaction, isLoading } = useTransactionStore()
  const [categories, setCategories] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterAccountType, setFilterAccountType] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editCategory, setEditCategory] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    fetchTransactions()
    fetchAccounts()
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await dataService.getCategories()
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  // Helper to safely parse amounts that might contain $ or ,
  const parseAmount = (val) => {
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
  }

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !filterCategory || tx.category_id === parseInt(filterCategory)
    const matchesType = !filterType || tx.type === filterType
    const matchesAccount = !filterAccount || tx.bank_account_id === parseInt(filterAccount)
    const matchesAccountType = !filterAccountType || tx.account_type === filterAccountType
    return matchesSearch && matchesCategory && matchesType && matchesAccount && matchesAccountType
  })

  const handleEdit = (tx) => {
    setEditingId(tx.id)
    setEditCategory(tx.category_id?.toString() || '')
  }

  const handleSaveEdit = async (id) => {
    if (!editCategory) return
    
    const result = await updateTransaction(id, { 
      category_id: parseInt(editCategory) 
    })
    
    if (result.success) {
      toast.success('Category updated')
      setEditingId(null)
    } else {
      toast.error(result.error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return
    
    const result = await deleteTransaction(id)
    if (result.success) {
      toast.success('Transaction deleted')
    } else {
      toast.error(result.error)
    }
  }

  // Updated calculations using the robust parseAmount helper
  const totalSpending = filteredTransactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + Math.abs(parseAmount(t.amount)), 0)

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + parseAmount(t.amount), 0)

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">View and manage all your transactions</p>
        </div>

        {/* Delete Transactions Button */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold
                     hover:bg-red-700 active:scale-95 transition-all shadow-sm shadow-red-200"
        >
          <Trash2 className="w-4 h-4" />
          Delete Transactions
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white min-w-[160px]"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white min-w-[130px]"
            >
              <option value="">All Transactions</option>
              <option value="debit">Spending</option>
              <option value="credit">Income</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white min-w-[160px]"
            >
              <option value="">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} - {acc.account_last_four || 'XXXX'}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterAccountType}
              onChange={(e) => setFilterAccountType(e.target.value)}
              className="pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white min-w-[150px]"
            >
              <option value="">All Card Types</option>
              <option value="credit">Credit Cards</option>
              <option value="debit">Debit Cards</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
          <span className="text-gray-600">
            <strong className="text-gray-900">{filteredTransactions.length}</strong> transactions
          </span>
          <span className="text-gray-600">
            Spending: <strong className="text-red-600">${totalSpending.toFixed(2)}</strong>
          </span>
          <span className="text-gray-600">
            Income: <strong className="text-green-600">${totalIncome.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {tx.description}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {editingId === tx.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveEdit(tx.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          tx.ai_categorized 
                            ? 'bg-primary-100 text-primary-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {tx.category_icon} {tx.category_name || 'Uncategorized'}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-4 text-sm text-right font-semibold whitespace-nowrap ${
                      tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {/* FIXED: Uses Math.abs to prevent the -$- double sign */}
                      {tx.type === 'credit' ? '+' : '-'}${Math.abs(parseAmount(tx.amount)).toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(tx)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title="Edit category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Transactions Modal */}
      {showDeleteModal && (
        <DeleteTransactionsModal
          categories={categories}
          transactions={transactions}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={fetchTransactions}
        />
      )}

      {/* Slide-up keyframe */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
      `}</style>
    </div>
  )
}