import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useTransactionStore } from '../store/transactionStore'
import api, { dataService } from '../services/api'
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  CreditCard
} from 'lucide-react'
import toast from 'react-hot-toast'

const MAX_PARALLEL_PARSES = 3

let nextId = 1

// Run async jobs with a concurrency limit
async function runWithLimit(items, limit, worker) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await worker(item)
    }
  })
  await Promise.all(runners)
}

function accountLabel(result) {
  if (!result?.bank_name) return 'Unknown account'
  const type = result.statement_type === 'credit' ? 'Credit card' : 'Checking / debit'
  const last4 = result.account_last4 ? ` ••${result.account_last4}` : ''
  return `${result.bank_name} ${type}${last4}`
}

export default function Upload() {
  // Each item: { id, file, status, result, error, saved, expanded }
  // status: pending | parsing | parsed | error | saving | saved
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const { fetchTransactions, fetchAccounts } = useTransactionStore()
  const navigate = useNavigate()

  const update = (id, patch) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))

  const onDrop = useCallback((acceptedFiles, rejected) => {
    if (rejected?.length) {
      toast.error(`${rejected.length} file(s) skipped: only PDFs up to 10MB are supported`)
    }
    setItems(prev => {
      const existing = new Set(prev.map(it => `${it.file.name}|${it.file.size}`))
      const added = acceptedFiles
        .filter(f => !existing.has(`${f.name}|${f.size}`))
        .map(file => ({ id: nextId++, file, status: 'pending', result: null, error: null, saved: null, expanded: false }))
      return [...prev, ...added]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024, // 10MB per file
    multiple: true,
    disabled: busy
  })

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id))
  const resetAll = () => setItems([])

  const parseOne = async (item) => {
    update(item.id, { status: 'parsing', error: null })
    try {
      const response = await dataService.parsePDF(item.file)
      if (response.data.success) {
        update(item.id, { status: 'parsed', result: response.data })
      } else {
        update(item.id, { status: 'error', error: response.data.message || 'Failed to parse PDF' })
      }
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.error || error.message || 'Failed to process PDF'
      update(item.id, { status: 'error', error: msg })
    }
  }

  const handleParseAll = async () => {
    const toParse = items.filter(it => it.status === 'pending' || it.status === 'error')
    if (!toParse.length) return
    setBusy(true)
    await runWithLimit(toParse, MAX_PARALLEL_PARSES, parseOne)
    setBusy(false)
  }

  const handleSaveAll = async () => {
    const toSave = items.filter(it => it.status === 'parsed')
    if (!toSave.length) return
    setBusy(true)

    let inserted = 0
    let skipped = 0
    let failed = 0

    // Save one statement at a time so account creation and duplicate checks don't race
    for (const item of toSave) {
      update(item.id, { status: 'saving' })
      const r = item.result
      try {
        const response = await api.post('/transactions/bulk', {
          transactions: r.transactions.map(t => ({
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            category_id: t.category_id,
            raw_description: t.description
          })),
          bank_metadata: {
            bank_name: r.bank_name,
            account_last4: r.account_last4,
            statement_type: r.statement_type
          },
          upload_metadata: {
            filename: item.file.name,
            statement_start_date: r.statement_start_date,
            statement_end_date: r.statement_end_date
          }
        })
        inserted += response.data.count
        skipped += response.data.skipped || 0
        update(item.id, { status: 'saved', saved: response.data })
      } catch (error) {
        failed++
        update(item.id, {
          status: 'parsed',
          error: error.response?.data?.error || 'Failed to save transactions'
        })
      }
    }

    await Promise.all([fetchTransactions(), fetchAccounts()])
    setBusy(false)

    if (failed) {
      toast.error(`${failed} statement(s) failed to save`)
    } else {
      toast.success(
        `Saved ${inserted} transaction${inserted === 1 ? '' : 's'}` +
          (skipped ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped)` : '')
      )
    }
  }

  const counts = items.reduce((acc, it) => ({ ...acc, [it.status]: (acc[it.status] || 0) + 1 }), {})
  const pendingCount = (counts.pending || 0) + (counts.error || 0)
  const parsedCount = counts.parsed || 0
  const allSaved = items.length > 0 && items.every(it => it.status === 'saved')
  const parsedTxTotal = items
    .filter(it => it.status === 'parsed')
    .reduce((sum, it) => sum + (it.result?.transactions_count || 0), 0)

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Statements</h1>
        <p className="text-gray-600">
          Upload one or more bank or credit card statement PDFs. Each is matched to its own account,
          and transactions you've already uploaded are skipped.
        </p>
      </div>

      {/* Drop zone */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div
          {...getRootProps()}
          className={`dropzone cursor-pointer ${isDragActive ? 'dropzone-active' : ''} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <UploadIcon className="w-12 h-12 text-gray-400 mb-4" />
            <p className="font-medium text-gray-900">
              {isDragActive ? 'Drop your PDFs here' : 'Drag & drop statements'}
            </p>
            <p className="text-sm text-gray-500 mt-1">or click to browse (you can select several files)</p>
            <p className="text-xs text-gray-400 mt-4">Chase, Bank of America and PNC PDFs, up to 10MB each</p>
          </div>
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="mt-6 space-y-3">
            {items.map(item => (
              <FileRow
                key={item.id}
                item={item}
                busy={busy}
                onRemove={() => removeItem(item.id)}
                onToggle={() => update(item.id, { expanded: !item.expanded })}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        {items.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {pendingCount > 0 && (
              <button
                onClick={handleParseAll}
                disabled={busy}
                className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy && counts.parsing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing with AI...</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Parse & Categorize {pendingCount} file{pendingCount > 1 ? 's' : ''}</>
                )}
              </button>
            )}

            {parsedCount > 0 && (
              <button
                onClick={handleSaveAll}
                disabled={busy}
                className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy && counts.saving ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                ) : (
                  <>Save {parsedTxTotal} transactions from {parsedCount} statement{parsedCount > 1 ? 's' : ''} <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            )}

            {allSaved && (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={resetAll}
              disabled={busy}
              className="py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
        <h4 className="font-medium text-blue-900 mb-2">Tips for best results</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Download statements directly from your bank's website</li>
          <li>• Make sure the PDFs are not password protected</li>
          <li>• You can mix accounts: checking, savings and credit cards are kept separate</li>
          <li>• Re-uploading a statement is safe; duplicates are skipped</li>
        </ul>
      </div>
    </div>
  )
}

function FileRow({ item, busy, onRemove, onToggle }) {
  const { file, status, result, error, saved, expanded } = item

  const statusBadge = {
    pending: <span className="text-xs text-gray-500">Ready</span>,
    parsing: <span className="text-xs text-primary-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Parsing</span>,
    parsed: <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {result?.transactions_count} found</span>,
    saving: <span className="text-xs text-primary-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>,
    saved: (
      <span className="text-xs text-green-700 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> {saved?.count} saved{saved?.skipped ? `, ${saved.skipped} duplicate${saved.skipped === 1 ? '' : 's'} skipped` : ''}
      </span>
    ),
    error: <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>
  }[status]

  return (
    <div className={`rounded-lg border ${status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
      <div className="p-3 flex items-center gap-3">
        <FileText className="w-8 h-8 text-primary-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{file.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            {result ? (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> {accountLabel(result)}
                {result.statement_start_date && ` · ${result.statement_start_date} → ${result.statement_end_date}`}
              </span>
            ) : (
              <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            )}
            {statusBadge}
          </div>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        {result?.transactions?.length > 0 && (
          <button onClick={onToggle} className="p-1 text-gray-500 hover:text-gray-700" title="Preview">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        )}
        {status !== 'saved' && (
          <button onClick={onRemove} disabled={busy} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50" title="Remove">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {expanded && result?.transactions?.length > 0 && (
        <div className="border-t border-gray-100 max-h-72 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.transactions.map((tx, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">{tx.date}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate">{tx.description}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                      {tx.category_name}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-sm text-right font-medium whitespace-nowrap ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.type === 'credit' ? '+' : '-'}${Math.abs(Number(tx.amount)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
