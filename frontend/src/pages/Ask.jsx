import { useState, useEffect, useRef } from 'react'
import { useTransactionStore } from '../store/transactionStore'
import { useChatStore } from '../store/chatStore'
import { dataService } from '../services/api'
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Sparkles,
  User,
  Bot
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Lightweight Markdown Renderer ──────────────────────────────────────────
function MarkdownMessage({ content }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0

  const renderInline = (text) => {
    // Bold + italic: ***text***
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
    text = text.replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    return text
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={i} className="bg-gray-800 text-green-300 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
          {codeLines.join('\n')}
        </pre>
      )
      i++
      continue
    }

    // Heading 3
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(4)) }} />)
      i++; continue
    }
    // Heading 2
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-gray-900 mt-4 mb-1 border-b border-gray-200 pb-1" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(3)) }} />)
      i++; continue
    }
    // Heading 1
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />)
      i++; continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-gray-200 my-2" />)
      i++; continue
    }

    // Bullet list (collect consecutive items)
    if (/^[\-\*•] /.test(line)) {
      const items = []
      while (i < lines.length && /^[\-\*•] /.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*•] /, ''))
        i++
      }
      elements.push(
        <ul key={i} className="list-disc list-inside space-y-1 my-1 pl-2">
          {items.map((item, j) => (
            <li key={j} className="text-sm" dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (/^\d+[\.\)] /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+[\.\)] /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[\.\)] /, ''))
        i++
      }
      elements.push(
        <ol key={i} className="list-decimal list-inside space-y-1 my-1 pl-2">
          {items.map((item, j) => (
            <li key={j} className="text-sm" dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ol>
      )
      continue
    }

    // Blank line → spacing
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
      i++; continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
    )
    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

export default function Ask() {
  const { transactions, fetchTransactions } = useTransactionStore()
  const { messages, isLoading: loading, addMessage, clearChat, setIsLoading: setLoading } = useChatStore()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (transactions.length === 0) {
      fetchTransactions()
    }
    loadSuggestions()
  }, [])

  // 3. FIX: Added 'loading' to dependency array
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const loadSuggestions = async () => {
    try {
      const response = await dataService.getQuerySuggestions()
      setSuggestions(response.data.suggestions || [])
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!query.trim() || loading) return

    if (transactions.length === 0) {
      toast.error('Upload some transactions first!')
      return
    }

    const userQuery = query.trim()
    setQuery('')
    
    addMessage({ type: 'user', content: userQuery })
    setLoading(true)

    try {
      const formattedTx = transactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: parseFloat(t.amount),
        type: t.type,
        category_id: t.category_id,
        category_name: t.category_name
      }))

      const response = await dataService.askQuestion(userQuery, formattedTx)
      
      addMessage({ 
        type: 'bot', 
        content: response.data.response,
        data: response.data.data,
        visualization: response.data.visualization
      })
    } catch (error) {
      console.error('Query error:', error)
      addMessage({ 
        type: 'bot', 
        content: 'Sorry, I had trouble processing your question. Please try again.',
        isError: true
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion)
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Ask AI</h1>
        <p className="text-gray-600">Ask questions about your finances in plain English</p>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Ask me anything about your finances
              </h3>
              <p className="text-gray-500 mb-6 max-w-md">
                I can help you understand your spending patterns, find specific transactions, 
                and give you insights about your financial habits.
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {suggestions.slice(0, 6).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // 2. FIX: Replaced Fragment with a div container
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.type === 'bot' && (
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-primary-600" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${msg.type === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        msg.type === 'user'
                          ? 'bg-primary-500 text-white'
                          : msg.isError
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.type === 'user' 
                        ? <p className="text-sm">{msg.content}</p>
                        : <MarkdownMessage content={msg.content} />
                      }
                    </div>
                    
                    {/* 1. FIX: Added explicit msg.type === 'bot' check */}
                    {msg.type === 'bot' && msg.data && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <pre className="text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(msg.data, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {/* 1. FIX: Added explicit msg.type === 'bot' check */}
                    {msg.type === 'bot' && msg.visualization && (
                      <div className="mt-2">
                        <img 
                          src={`data:image/png;base64,${msg.visualization}`}
                          alt="Chart generated by AI"
                          className="rounded-lg border border-gray-200 max-w-full"
                        />
                      </div>
                    )}
                  </div>

                  {msg.type === 'user' && (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                      <span className="text-gray-500">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={loading || transactions.length === 0}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading || !query.trim() || transactions.length === 0}
              className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          
          {transactions.length === 0 && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              Upload transactions first to start asking questions
            </p>
          )}
        </div>
      </div>
    </div>
  )
}