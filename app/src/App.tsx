import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Slide {
  id: string
  title: string
  backgroundColor: string
  textColor: string
  content: string
  interactiveType: 'counter' | 'toggle' | 'input' | 'progress' | 'ticket-form' | 'techstack'
  techStack?: { name: string; icon: string }[]
}

const slides: Slide[] = [
  {
    id: 'intro',
    title: 'Introduction',
    backgroundColor: '#1a1a2e',
    textColor: '#eaeaea',
    content: 'Automated customer support with AI. In this demo app you can create support tickets for an imaginary solar installation company "Sunshine Solar".',
    interactiveType: 'techstack',
    techStack: [
      { name: 'React', icon: '⚛️' },
      { name: 'TypeScript', icon: '📘' },
      { name: 'FastAPI', icon: '' },
      { name: 'OpenAI', icon: '🤖' },
      { name: 'PostgreSQL', icon: '🐘' },
      { name: 'Tailwind CSS', icon: '🎨' }
    ]
  },
  {
    id: 'features',
    title: 'Create a Support Ticket',
    backgroundColor: '#16213e',
    textColor: '#e8e8e8',
    content: 'Submit your support request below and our AI will assist you.',
    interactiveType: 'ticket-form'
  },
  {
    id: 'how-it-works',
    title: 'coming soon',
    backgroundColor: '#0f3460',
    textColor: '#f1f1f1',
    content: 'Natural language processing understands customer intent. Machine learning improves responses over time. Seamless handoff to human agents when needed.',
    interactiveType: 'progress'
  },
  {
    id: 'benefits',
    title: 'coming soon',
    backgroundColor: '#533483',
    textColor: '#ffffff',
    content: 'Reduce response time by 80%. Handle unlimited concurrent conversations. Cut support costs while improving satisfaction scores.',
    interactiveType: 'toggle'
  },
  {
    id: 'demo',
    title: 'coming soon',
    backgroundColor: '#e94560',
    textColor: '#ffffff',
    content: 'Experience our AI assistant firsthand. Type a question below and see how quickly and accurately it responds.',
    interactiveType: 'input'
  }
]

function App() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [backgroundColor, setBackgroundColor] = useState(slides[0].backgroundColor)
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
                setBackgroundColor(slides[index].backgroundColor)
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
    <div className="presentation" style={{ backgroundColor }}>
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
            style={{ color: slide.textColor }}
          >
            <div className="slide-content">
              <h2 className="slide-title">{slide.title}</h2>
              <p className="slide-text">{slide.content}</p>
              <InteractiveElement type={slide.interactiveType} />
            </div>
          </div>
        ))}
      </main>

      <div className="scroll-hint">
        <span>Scroll to explore</span>
        <div className="scroll-arrow"></div>
      </div>
    </div>
  )
}

const techStack = slides.find(s => s.id === 'intro')?.techStack || []

function InteractiveElement({ type }: { type: Slide['interactiveType'] }) {
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

  useEffect(() => {
    if (type === 'progress') {
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 1))
      }, 50)
      return () => clearInterval(interval)
    }
  }, [type])

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
          <h3 className="tech-stack-title">Built With</h3>
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
