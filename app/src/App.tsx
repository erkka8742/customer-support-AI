import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Slide {
  id: string
  title: string
  content: string
  interactiveType: 'counter' | 'toggle' | 'input' | 'progress' | 'ticket-form' | 'techstack' | 'ticket-list' | 'company-data' | 'solved-tickets' | 'manual-review-tickets' | 'how-it-works'
  techStack?: { name: string; icon: string }[]
}

interface Ticket {
  id: number
  name: string
  topic: string
  description: string
}

interface CompanyDoc {
  id: number
  category: string
  document_title: string
  content: string
}

interface SupportDoc {
  content: string
  category: string
  document_title: string
  relevance_score: number
}

interface TicketAnswer {
  ticket: Ticket
  answer: string
  sources: SupportDoc[]
}

interface SolvedTicket {
  id: number
  name: string
  topic: string
  description: string
  ai_answer: string
}

interface ManualReviewTicket {
  id: number
  name: string
  topic: string
  description: string
}

const slides: Slide[] = [
  {
    id: 'intro',
    title: 'Introduction',
    content: 'Automated customer support with AI. In this demo app you can create support tickets for an imaginary solar installation company "Sunshine Solar".',
    interactiveType: 'techstack',
    techStack: [
      { name: 'React, TypeScript', icon: '⚛️' },
      { name: 'Python, FastAPI', icon: '🐍' },
      { name: 'Gemini API', icon: '🤖' },
      { name: 'PostgreSQL', icon: '🐘' },
      { name: 'Pinecone', icon: '🌲' }
    ]
  },
  {
    id: 'how-it-works',
    title: 'How It Works',
    content: '',
    interactiveType: 'how-it-works'
  },
  {
    id: 'company-data',
    title: 'Company Proprietary Information',
    content: 'Company information stored in Pinecone vector database. The AI uses this information for solving tickets.',
    interactiveType: 'company-data'
  },
  {
    id: 'create-ticket',
    title: 'Create a Support Ticket',
    content: 'Submit your support request below and our AI will assist you.',
    interactiveType: 'ticket-form'
  },
  {
    id: 'see-tickets',
    title: 'New Tickets',
    content: 'Click on a ticket to generate an AI response.',
    interactiveType: 'ticket-list'
  },
  {
    id: 'manual-review',
    title: 'Manual Review',
    content: 'Tickets the AI could not solve. Write an answer and mark them as solved.',
    interactiveType: 'manual-review-tickets'
  },
  {
    id: 'solved',
    title: 'Solved Tickets',
    content: 'All resolved tickets with their answers.',
    interactiveType: 'solved-tickets'
  },
]

function App() {
  const [activeSlide, setActiveSlide] = useState(0)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    slideRefs.current.forEach((ref, index) => {
      if (ref) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                setActiveSlide(index)
              }
            })
          },
          { threshold: 0.5 }
        )
        observer.observe(ref)
        observers.push(observer)
      }
    })

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [])

  const scrollToSlide = (index: number) => {
    slideRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="presentation">
      <header className="main-header">
        <h1>AI Customer Support Demo</h1>
      </header>

      <nav className="sidebar">
        <ul>
          {slides.map((slide, index) => (
            <li key={slide.id}>
              <button
                className={`nav-item ${activeSlide === index ? 'active' : ''}`}
                onClick={() => scrollToSlide(index)}
              >
                <span className="nav-indicator"></span>
                <span className="nav-title">{slide.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="slides-container">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(el) => { slideRefs.current[index] = el }}
            className={`slide ${activeSlide === index ? 'active' : ''}`}
          >
            <div className="slide-content">
              <h2 className="slide-title">{slide.title}</h2>
              <p className="slide-text">{slide.content}</p>
              <InteractiveElement type={slide.interactiveType} isActive={activeSlide === index} />
            </div>
          </div>
        ))}
      </main>

      <div className="scroll-hint">
        <span>Scroll to next section</span>
        <div className="scroll-arrow"></div>
      </div>
    </div>
  )
}

const techStack = slides.find(s => s.id === 'intro')?.techStack || []

function InteractiveElement({ type, isActive }: { type: Slide['interactiveType']; isActive: boolean }) {
  const [count, setCount] = useState(0)
  const [toggles, setToggles] = useState([false, false, false])
  const [inputValue, setInputValue] = useState('')
  const [response, setResponse] = useState('')
  const [progress, setProgress] = useState(0)
  const [ticketFormData, setTicketFormData] = useState({
    name: '',
    topic: '',
    description: ''
  })
  const [generatingTicket, setGeneratingTicket] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [companyDocs, setCompanyDocs] = useState<CompanyDoc[]>([])
  const [selectedTicketAnswer, setSelectedTicketAnswer] = useState<TicketAnswer | null>(null)
  const [loadingAnswer, setLoadingAnswer] = useState(false)
  const [expandedSources, setExpandedSources] = useState<number[]>([])
  const [resolvingTicket, setResolvingTicket] = useState(false)
  const [solvedTickets, setSolvedTickets] = useState<SolvedTicket[]>([])
  const [manualReviewTickets, setManualReviewTickets] = useState<ManualReviewTicket[]>([])
  const [manualAnswers, setManualAnswers] = useState<Record<number, string>>({})
  const [solvingManual, setSolvingManual] = useState<number | null>(null)

  const fetchCompanyDocs = async () => {
    const response = await fetch("http://localhost:8000/api/company-data")
    const data = await response.json()
    setCompanyDocs(data)
  }

  const fetchTickets = async () => {
    const response = await fetch("http://localhost:8000/api/tickets")
    const data = await response.json()
    setTickets(data)
  }

  const fetchSolvedTickets = async () => {
    const response = await fetch("http://localhost:8000/api/solved-tickets")
    const data = await response.json()
    setSolvedTickets(data)
  }

  const fetchManualReviewTickets = async () => {
    const response = await fetch("http://localhost:8000/api/manual-review-tickets")
    const data = await response.json()
    setManualReviewTickets(data)
  }

  const solveManualTicket = async (ticketId: number) => {
    const answer = manualAnswers[ticketId]?.trim()
    if (!answer) return
    setSolvingManual(ticketId)
    try {
      await fetch(`http://localhost:8000/api/manual-review-tickets/${ticketId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
      setManualAnswers(prev => { const next = { ...prev }; delete next[ticketId]; return next })
      fetchManualReviewTickets()
    } finally {
      setSolvingManual(null)
    }
  }

  const fetchTicketAnswer = async (ticketId: number) => {
    setLoadingAnswer(true)
    setExpandedSources([])
    try {
      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/answer`)
      const data = await response.json()
      setSelectedTicketAnswer(data)
    } catch (error) {
      console.error("Error fetching answer:", error)
    } finally {
      setLoadingAnswer(false)
    }
  }

  useEffect(() => {
    const isOpen = loadingAnswer || !!selectedTicketAnswer
    const container = document.querySelector('.slides-container') as HTMLElement | null
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (container) container.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
      if (container) container.style.overflow = ''
    }
  }, [loadingAnswer, selectedTicketAnswer])

  const toggleSource = (index: number) => {
    setExpandedSources(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const deleteTicket = async (ticketId: number) => {
    await fetch(`http://localhost:8000/api/tickets/${ticketId}`, { method: 'DELETE' })
    fetchTickets()
  }

  const resolveTicket = async (solved: boolean) => {
    if (!selectedTicketAnswer) return
    setResolvingTicket(true)
    try {
      await fetch(`http://localhost:8000/api/tickets/${selectedTicketAnswer.ticket.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solved, ai_answer: solved ? selectedTicketAnswer.answer : null }),
      })
      setSelectedTicketAnswer(null)
      fetchTickets()
    } finally {
      setResolvingTicket(false)
    }
  }

  useEffect(() => {
    if (type === 'progress') {
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 1))
      }, 50)
      return () => clearInterval(interval)
    }
    if (type === 'ticket-list' && isActive) {
      fetchTickets()
    }
    if (type === 'company-data') {
      fetchCompanyDocs()
    }
    if (type === 'solved-tickets' && isActive) {
      fetchSolvedTickets()
    }
    if (type === 'manual-review-tickets' && isActive) {
      fetchManualReviewTickets()
    }
  }, [type, isActive])

  const handleToggle = (index: number) => {
    const newToggles = [...toggles]
    newToggles[index] = !newToggles[index]
    setToggles(newToggles)
  }

  const handleSubmit = () => {
    if (inputValue.trim()) {
      setResponse(`AI Response: Thank you for your question about "${inputValue}". Our AI is processing your request...`)
      setInputValue('')
    }
  }

  const TICKET_TOPICS = [
    'Account Management',
    'Basic Troubleshooting',
    'Weather & Maintenance',
    'Physical Care & Safety',
    'General Information',
  ]

  const generateTicket = async (category: string) => {
    setGeneratingTicket(true)
    try {
      const response = await fetch('http://localhost:8000/api/generate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      const data = await response.json()
      setTicketFormData({ name: data.name, topic: data.topic, description: data.description })
    } catch (error) {
      console.error('Error generating ticket:', error)
    } finally {
      setGeneratingTicket(false)
    }
  }

  const createTicket = async () => {
    const response = await fetch("http://localhost:8000/api/new-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ticketFormData.name, topic: ticketFormData.topic, description: ticketFormData.description }),
    });
    const data = await response.json();
    setTicketFormData({ name: '', topic: '', description: '' });
    console.log(data);
  };


  switch (type) {
    case 'techstack':
      return (
        <div className="interactive tech-stack">
          <h3 className="tech-stack-title">Built by Erkka Lappala using</h3>
          <div className="tech-stack-grid">
            {techStack.map((tech, i) => (
              <div key={i} className="tech-item">
                <span className="tech-icon">{tech.icon}</span>
                <span className="tech-name">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      )

    case 'how-it-works':
      return (
        <div className="interactive how-it-works">
          <div className="hiw-steps">
            <div className="hiw-step">
              <div className="hiw-step-number">1</div>
              <div className="hiw-step-body">
                <h4>Customer submits a ticket</h4>
                <p>You can act as a customer and submit a ticket. Fill in a name, topic, and a description of your issue. Tickets can also be auto-generated by Gemini 3 Flash. The ticket is saved to a PostgreSQL database.</p>
              </div>
            </div>
            <div className="hiw-step">
              <div className="hiw-step-number">2</div>
              <div className="hiw-step-body">
                <h4>Semantic search against the knowledge base</h4>
                <p>The AI needs context to answer the ticket, so the ticket topic and description are used as a search query for Pinecone. It's a vector database holding 50 pieces of information about Sunshine Solar. Pinecone finds the three semantically closest documents using embedding-based similarity search.</p>
              </div>
            </div>
            <div className="hiw-step">
              <div className="hiw-step-number">3</div>
              <div className="hiw-step-body">
                <h4>Gemini creates a response</h4>
                <p>The retrieved documents are added into a prompt as context, along with the customer's ticket. Gemini reads both and generates a helpful, accurate support response based in the company's own documentation, not generic AI knowledge.
                </p>
              </div>
            </div>
            <div className="hiw-step">
              <div className="hiw-step-number">4</div>
              <div className="hiw-step-body">
                <h4>Review and resolve</h4>
                <p>You can see the AI-generated answer and the source documents it used. If the answer is good, mark the ticket as solved. It then moves to the Solved Tickets archive with the answer attached. If the AI couldn't handle it, the ticket goes to Manual Review, where you can write an answer and close it from there.</p>
              </div>
            </div>
          </div>
        </div>
      )

    case 'counter':
      return (
        <div className="interactive counter">
          <p className="counter-label">Customers helped today:</p>
          <div className="counter-display">{count.toLocaleString()}</div>
          <button className="interactive-btn" onClick={() => setCount(count + 100)}>
            + Add 100
          </button>
        </div>
      )

    case 'ticket-form':
      return (
        <div className="interactive ticket-form">
          <div className="generate-ticket-section">
            <p className="generate-ticket-label">Automatically generate a ticket for these topics</p>
            <div className="generate-topic-buttons">
              {TICKET_TOPICS.map((topic) => (
                <button
                  key={topic}
                  className={`topic-btn ${generatingTicket ? 'disabled' : ''}`}
                  onClick={() => generateTicket(topic)}
                  disabled={generatingTicket}
                >
                  {topic}
                </button>
              ))}
            </div>
            {generatingTicket && <p className="generating-text">Generating ticket...</p>}
          </div>
          <div className="form-group">
            <label htmlFor="ticket-name">Name</label>
            <input
              type="text"
              id="ticket-name"
              placeholder="Your name"
              value={ticketFormData.name}
              onChange={(e) => setTicketFormData({ ...ticketFormData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="ticket-topic">Topic</label>
            <input
              type="text"
              id="ticket-topic"
              placeholder="What is this about?"
              value={ticketFormData.topic}
              onChange={(e) => setTicketFormData({ ...ticketFormData, topic: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="ticket-content">Description</label>
            <textarea
              id="ticket-content"
              placeholder="Describe your issue or question..."
              rows={4}
              value={ticketFormData.description}
              onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
            />
          </div>
          <button className="submit-ticket-btn" onClick={createTicket}>Submit Ticket</button>
        </div>
      )

    case 'progress':
      return (
        <div className="interactive progress-demo">
          <div className="progress-steps">
            <div className={`step ${progress > 0 ? 'active' : ''}`}>
              <span className="step-icon">📝</span>
              <span>Receive Query</span>
            </div>
            <div className={`step ${progress > 33 ? 'active' : ''}`}>
              <span className="step-icon">🔍</span>
              <span>Analyze Intent</span>
            </div>
            <div className={`step ${progress > 66 ? 'active' : ''}`}>
              <span className="step-icon">💡</span>
              <span>Generate Response</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )

    case 'ticket-list':
      return (
        <div className="interactive ticket-list">
          <button className="refresh-btn" onClick={fetchTickets}>Refresh</button>
          <div className="tickets-container">
            {tickets.length === 0 ? (
              <p className="no-tickets">No tickets yet</p>
            ) : (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="ticket-card clickable"
                  onClick={() => fetchTicketAnswer(ticket.id)}
                >
                  <div className="ticket-header">
                    <span className="ticket-id">#{ticket.id}</span>
                    <span className="ticket-topic">{ticket.topic}</span>
                    <button
                      className="delete-ticket-btn"
                      onClick={(e) => { e.stopPropagation(); deleteTicket(ticket.id) }}
                      title="Delete ticket"
                    >×</button>
                  </div>
                  <p className="ticket-name">From: {ticket.name}</p>
                  <p className="ticket-description">{ticket.description}</p>
                </div>
              ))
            )}
          </div>

          {/* AI Answer Modal */}
          {(loadingAnswer || selectedTicketAnswer) && (
            <div className="modal-overlay" onClick={() => setSelectedTicketAnswer(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setSelectedTicketAnswer(null)}>×</button>

                {loadingAnswer ? (
                  <div className="loading-answer">
                    <div className="loading-spinner"></div>
                    <p>Generating AI response...</p>
                  </div>
                ) : selectedTicketAnswer && (
                  <>
                    <div className="modal-ticket-info">
                      <h3>Ticket #{selectedTicketAnswer.ticket.id}</h3>
                      <span className="modal-topic">{selectedTicketAnswer.ticket.topic}</span>
                      <div className="modal-ticket-meta">
                        <div className="modal-meta-item">
                          <div className="modal-meta-label">From</div>
                          <div className="modal-meta-value">{selectedTicketAnswer.ticket.name}</div>
                        </div>
                        <div className="modal-meta-item full-width">
                          <div className="modal-meta-label">Issue</div>
                          <div className="modal-meta-value">{selectedTicketAnswer.ticket.description}</div>
                        </div>
                      </div>
                    </div>

                    <div className="modal-answer">
                      <div className="modal-section-label">AI Generated Response</div>
                      <div className="answer-text">{selectedTicketAnswer.answer}</div>
                    </div>

                    <div className="modal-sources">
                      <div className="modal-section-label">Sources Used</div>
                      {selectedTicketAnswer.sources.map((source, i) => (
                        <div
                          key={i}
                          className={`source-item ${expandedSources.includes(i) ? 'expanded' : ''}`}
                          onClick={() => toggleSource(i)}
                        >
                          <div className="source-header">
                            <span className="source-title">{source.document_title}</span>
                            <span className="source-category">{source.category}</span>
                            <span className="source-toggle">{expandedSources.includes(i) ? '▲' : '▼'}</span>
                          </div>
                          {expandedSources.includes(i) && (
                            <div className="source-content">{source.content}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="modal-resolve-actions">
                      <button
                        className="resolve-btn resolve-solved"
                        onClick={() => resolveTicket(true)}
                        disabled={resolvingTicket}
                      >
                        Ticket solved
                      </button>
                      <button
                        className="resolve-btn resolve-manual"
                        onClick={() => resolveTicket(false)}
                        disabled={resolvingTicket}
                      >
                        Ticket unsolved: request manual review
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )

    case 'manual-review-tickets':
      return (
        <div className="interactive ticket-list">
          <div className="tickets-container">
            {manualReviewTickets.length === 0 ? (
              <p className="no-tickets">No tickets awaiting manual review</p>
            ) : (
              manualReviewTickets.map((ticket) => (
                <div key={ticket.id} className="ticket-card manual-review-card">
                  <div className="ticket-header">
                    <span className="ticket-id">#{ticket.id}</span>
                    <span className="ticket-topic">{ticket.topic}</span>
                  </div>
                  <p className="ticket-name">From: {ticket.name}</p>
                  <p className="ticket-description">{ticket.description}</p>
                  <textarea
                    className="manual-answer-input"
                    placeholder="Write your answer here..."
                    rows={3}
                    value={manualAnswers[ticket.id] ?? ''}
                    onChange={(e) => setManualAnswers(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                  />
                  <button
                    className="solve-manual-btn"
                    onClick={() => solveManualTicket(ticket.id)}
                    disabled={!manualAnswers[ticket.id]?.trim() || solvingManual === ticket.id}
                  >
                    {solvingManual === ticket.id ? 'Solving...' : 'Solve'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )

    case 'solved-tickets':
      return (
        <div className="interactive ticket-list">
          <div className="tickets-container">
            {solvedTickets.length === 0 ? (
              <p className="no-tickets">No solved tickets yet</p>
            ) : (
              solvedTickets.map((ticket) => (
                <div key={ticket.id} className="ticket-card solved-ticket-card">
                  <div className="ticket-header">
                    <span className="ticket-id">#{ticket.id}</span>
                    <span className="ticket-topic">{ticket.topic}</span>
                  </div>
                  <p className="ticket-name">From: {ticket.name}</p>
                  <p className="ticket-description">{ticket.description}</p>
                  <div className="solved-answer">
                    <span className="solved-answer-label">Answer</span>
                    <p className="solved-answer-text">{ticket.ai_answer}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )

    case 'company-data':
      return (
        <div className="interactive company-data">
          <div className="company-docs-container">
            {companyDocs.length === 0 ? (
              <p className="no-docs">Loading documents...</p>
            ) : (
              companyDocs.map((doc) => (
                <div key={doc.id} className="company-doc-card">
                  <div className="doc-header">
                    <span className="doc-category">{doc.category}</span>
                    <span className="doc-title">{doc.document_title}</span>
                  </div>
                  <p className="doc-content">{doc.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )

    case 'toggle':
      return (
        <div className="interactive toggles">
          {['Faster Response', 'Cost Savings', 'Higher Satisfaction'].map((benefit, i) => (
            <div key={i} className="toggle-item">
              <span>{benefit}</span>
              <button
                className={`toggle-switch ${toggles[i] ? 'on' : ''}`}
                onClick={() => handleToggle(i)}
              >
                <span className="toggle-knob"></span>
              </button>
              {toggles[i] && <span className="toggle-stat">{['80%', '60%', '95%'][i]}</span>}
            </div>
          ))}
        </div>
      )

    case 'input':
      return (
        <div className="interactive input-demo">
          <div className="chat-input-container">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question..."
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button className="send-btn" onClick={handleSubmit}>Send</button>
          </div>
          {response && <div className="ai-response">{response}</div>}
        </div>
      )

    default:
      return null
  }
}

export default App
