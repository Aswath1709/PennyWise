import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useTransactionStore } from '../store/transactionStore'
import { dataService } from '../services/api'
import { 
  Upload as UploadIcon, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const { bulkAddTransactions } = useTransactionStore()
  const navigate = useNavigate()

  const onDrop = useCallback((acceptedFiles) => {
    const pdfFile = acceptedFiles[0]
    if (pdfFile && pdfFile.type === 'application/pdf') {
      setFile(pdfFile)
      setResult(null)
    } else {
      toast.error('Please upload a PDF file')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  })

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      const response = await dataService.parsePDF(file)
      setResult(response.data)
      
      if (response.data.success) {
        toast.success(`Found ${response.data.transactions_count} transactions!`)
      } else {
        toast.error(response.data.message || 'Failed to parse PDF')
      }
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message || 'Failed to process PDF'
      toast.error(errorMessage)
      setResult({ success: false, message: errorMessage })
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!result?.transactions) return

    setSaving(true)
    try {
      const formattedTransactions = result.transactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category_id: t.category_id,
        category_name: t.category_name,
        ai_categorized: true,
        raw_description: t.description
      }))

      const bank_metadata = {
        bank_name: result.bank_name,
        account_last4: result.account_last4,
        statement_type: result.statement_type
      }

      const saveResult = await bulkAddTransactions(formattedTransactions, bank_metadata)
      
      if (saveResult.success) {
        toast.success(`Saved ${saveResult.count} transactions!`)
        navigate('/dashboard')
      } else {
        toast.error(saveResult.error || 'Failed to save transactions')
      }
    } catch (error) {
      toast.error('Failed to save transactions')
    } finally {
      setSaving(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setResult(null)
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Statement</h1>
        <p className="text-gray-600">Upload your Chase bank statement PDF for AI-powered analysis</p>
      </div>

      {/* Upload Zone */}
      {!result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div
            {...getRootProps()}
            className={`dropzone cursor-pointer ${isDragActive ? 'dropzone-active' : ''} ${file ? 'border-primary-500 bg-primary-50' : ''}`}
          >
            <input {...getInputProps()} />
            
            {file ? (
              <div className="flex flex-col items-center">
                <FileText className="w-12 h-12 text-primary-500 mb-4" />
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                  className="mt-4 text-sm text-red-600 hover:text-red-700"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadIcon className="w-12 h-12 text-gray-400 mb-4" />
                <p className="font-medium text-gray-900">
                  {isDragActive ? 'Drop your PDF here' : 'Drag & drop your bank statement'}
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-4">Supports Chase PDF statements up to 10MB</p>
              </div>
            )}
          </div>

          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full mt-6 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Parse & Categorize
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Status Card */}
          <div className={`p-6 rounded-xl ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? 'PDF Processed Successfully!' : 'Processing Failed'}
                </h3>
                <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.message}
                </p>
                {result.success && (
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="text-green-700">
                      <strong>{result.transactions_count}</strong> transactions found
                    </span>
                    {result.statement_start_date && (
                      <span className="text-green-700">
                        Period: {result.statement_start_date} to {result.statement_end_date}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transactions Preview */}
          {result.success && result.transactions?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Transactions Preview</h3>
                <p className="text-sm text-gray-500">Review the AI-categorized transactions</p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.transactions.slice(0, 20).map((tx, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{tx.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{tx.description}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                            {tx.category_name}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                          {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.transactions.length > 20 && (
                  <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                    And {result.transactions.length - 20} more transactions...
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={resetUpload}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Upload Different File
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Transactions
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Retry on failure */}
          {!result.success && (
            <button
              onClick={resetUpload}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
        <h4 className="font-medium text-blue-900 mb-2">Tips for best results</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Download your statement directly from Chase's website</li>
          <li>• Make sure the PDF is not password protected</li>
          <li>• Currently supports Chase checking/savings statements</li>
          <li>• AI will automatically categorize your transactions</li>
        </ul>
      </div>
    </div>
  )
}
