import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google import genai
from google.genai import types
from database import engine, get_db, Base
from models import Ticket as TicketModel, SolvedTicket, ManualReviewTicket
from pinecone_setup import query_docs

load_dotenv()

# Configure Gemini client (uses GEMINI_API_KEY env var)
os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client()
GEMINI_MODEL = "gemini-3-flash-preview"


def gemini_generate(prompt: str) -> str:
    response = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt, config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="minimal")
    ),)
    return response.text

Base.metadata.create_all(bind=engine)

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.get_event_loop().run_in_executor(None, _load_data_if_empty)


def _load_data_if_empty():
    try:
        from pinecone_setup import index, load_solar_data
        stats = index.describe_index_stats()
        if stats.total_vector_count == 0:
            print("Pinecone index is empty — loading solar data...")
            load_solar_data()
    except Exception as e:
        print(f"Startup data load error: {e}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://customer-support-ai-1.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TicketCreate(BaseModel):
    name: str
    topic: str
    description: str


class TicketResponse(BaseModel):
    id: int
    name: str
    topic: str
    description: str

    class Config:
        from_attributes = True


class SupportDoc(BaseModel):
    content: str
    category: str
    document_title: str
    relevance_score: float


class TicketWithDocs(BaseModel):
    ticket: TicketResponse
    relevant_docs: List[SupportDoc]


@app.post("/api/new-ticket", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    db_ticket = TicketModel(
        name=ticket.name,
        topic=ticket.topic,
        description=ticket.description
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket


@app.get("/api/tickets", response_model=List[TicketResponse])
def get_tickets(db: Session = Depends(get_db)):
    tickets = db.query(TicketModel).order_by(TicketModel.id.desc()).all()
    return tickets


@app.get("/api/tickets/{ticket_id}/suggestions", response_model=TicketWithDocs)
def get_ticket_suggestions(ticket_id: int, db: Session = Depends(get_db)):
    """Get a ticket with relevant support documents for AI-assisted solving"""
    ticket = db.query(TicketModel).filter(TicketModel.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Combine topic and description for better semantic search
    search_query = f"{ticket.topic} {ticket.description}"
    results = query_docs(search_query, n_results=3)

    relevant_docs = []
    for i, doc in enumerate(results["documents"][0]):
        # ChromaDB returns distances, convert to similarity score (lower distance = higher relevance)
        distance = results["distances"][0][i] if results.get("distances") else 0
        relevance_score = 1 / (1 + distance)  # Convert distance to 0-1 score

        relevant_docs.append(SupportDoc(
            content=doc,
            category=results["metadatas"][0][i]["category"],
            document_title=results["metadatas"][0][i]["document_title"],
            relevance_score=round(relevance_score, 3)
        ))

    return TicketWithDocs(
        ticket=TicketResponse.model_validate(ticket),
        relevant_docs=relevant_docs
    )


@app.get("/api/search-docs", response_model=List[SupportDoc])
def search_docs(query: str, n_results: int = 3):
    """Search support documents directly"""
    results = query_docs(query, n_results=n_results)

    docs = []
    for i, doc in enumerate(results["documents"][0]):
        distance = results["distances"][0][i] if results.get("distances") else 0
        relevance_score = 1 / (1 + distance)

        docs.append(SupportDoc(
            content=doc,
            category=results["metadatas"][0][i]["category"],
            document_title=results["metadatas"][0][i]["document_title"],
            relevance_score=round(relevance_score, 3)
        ))

    return docs


class CompanyDoc(BaseModel):
    id: int
    category: str
    document_title: str
    content: str


class TicketAnswer(BaseModel):
    ticket: TicketResponse
    answer: str
    sources: List[SupportDoc]


class GenerateTicketRequest(BaseModel):
    category: str


class GeneratedTicket(BaseModel):
    name: str
    topic: str
    description: str


@app.post("/api/generate-ticket", response_model=GeneratedTicket)
def generate_ticket_for_category(request: GenerateTicketRequest):
    """Generate a realistic customer support ticket for a given category using Gemini"""
    import json
    with open("solar_data.json", "r") as f:
        solar_data = json.load(f)

    # Filter docs by category for focused context
    category_docs = [doc for doc in solar_data if doc["category"] == request.category]
    # Fall back to all docs if category not found
    if not category_docs:
        category_docs = solar_data

    docs_text = "\n".join(
        f"- [{doc['document_title']}]: {doc['content']}"
        for doc in category_docs
    )

    prompt = f"""You are simulating a customer of Sunshine Solar, a solar panel installation company.

Based on the following company knowledge base documents about the category "{request.category}", generate a realistic customer support ticket.

KNOWLEDGE BASE DOCUMENTS (category: {request.category}):
{docs_text}

Generate a support ticket in exactly this JSON format (no markdown, no code blocks, just raw JSON):
{{
  "name": "<a realistic first and last name>",
  "topic": "<a short topic phrase, 3-7 words>",
  "description": "<a realistic customer message describing their issue or question, 2-4 sentences>"
}}

The ticket must be clearly related to the "{request.category}" category. Write in a natural, non-technical customer voice."""

    raw = gemini_generate(prompt).strip()
    # Strip markdown code blocks if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    ticket_data = json.loads(raw)

    return GeneratedTicket(
        name=ticket_data["name"],
        topic=ticket_data["topic"],
        description=ticket_data["description"]
    )


@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(TicketModel).filter(TicketModel.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return {"status": "ok"}


class ResolveTicketRequest(BaseModel):
    solved: bool
    ai_answer: Optional[str] = None


@app.post("/api/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: int, request: ResolveTicketRequest, db: Session = Depends(get_db)):
    ticket = db.query(TicketModel).filter(TicketModel.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if request.solved:
        db.add(SolvedTicket(
            name=ticket.name,
            topic=ticket.topic,
            description=ticket.description,
            ai_answer=request.ai_answer or ""
        ))
    else:
        db.add(ManualReviewTicket(
            name=ticket.name,
            topic=ticket.topic,
            description=ticket.description
        ))

    db.delete(ticket)
    db.commit()
    return {"status": "ok"}


class SolvedTicketResponse(BaseModel):
    id: int
    name: str
    topic: str
    description: str
    ai_answer: str

    class Config:
        from_attributes = True


class ManualReviewTicketResponse(BaseModel):
    id: int
    name: str
    topic: str
    description: str

    class Config:
        from_attributes = True


class SolveManualTicketRequest(BaseModel):
    answer: str


@app.get("/api/solved-tickets", response_model=List[SolvedTicketResponse])
def get_solved_tickets(db: Session = Depends(get_db)):
    return db.query(SolvedTicket).order_by(SolvedTicket.id.desc()).all()


@app.get("/api/manual-review-tickets", response_model=List[ManualReviewTicketResponse])
def get_manual_review_tickets(db: Session = Depends(get_db)):
    return db.query(ManualReviewTicket).order_by(ManualReviewTicket.id.desc()).all()


@app.post("/api/manual-review-tickets/{ticket_id}/solve", response_model=SolvedTicketResponse)
def solve_manual_ticket(ticket_id: int, request: SolveManualTicketRequest, db: Session = Depends(get_db)):
    ticket = db.query(ManualReviewTicket).filter(ManualReviewTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    solved = SolvedTicket(
        name=ticket.name,
        topic=ticket.topic,
        description=ticket.description,
        ai_answer=request.answer
    )
    db.add(solved)
    db.delete(ticket)
    db.commit()
    db.refresh(solved)
    return solved


@app.get("/api/company-data", response_model=List[CompanyDoc])
def get_company_data():
    """Get all company proprietary documents"""
    import json
    with open("solar_data.json", "r") as f:
        data = json.load(f)
    return data


@app.get("/api/tickets/{ticket_id}/answer", response_model=TicketAnswer)
def generate_ticket_answer(ticket_id: int, db: Session = Depends(get_db)):
    """Generate an AI answer for a ticket using Pinecone context and Gemini"""
    ticket = db.query(TicketModel).filter(TicketModel.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Query Pinecone for relevant documents
    search_query = f"{ticket.topic} {ticket.description}"
    results = query_docs(search_query, n_results=3)

    # Build context from relevant docs
    sources = []
    context_parts = []
    for i, doc in enumerate(results["documents"][0]):
        distance = results["distances"][0][i] if results.get("distances") else 0
        relevance_score = 1 / (1 + distance)

        sources.append(SupportDoc(
            content=doc,
            category=results["metadatas"][0][i]["category"],
            document_title=results["metadatas"][0][i]["document_title"],
            relevance_score=round(relevance_score, 3)
        ))
        context_parts.append(f"[{results['metadatas'][0][i]['document_title']}]: {doc}")

    context = "\n\n".join(context_parts)

    # Generate answer with Gemini
    prompt = f"""You are a helpful customer support agent for Sunshine Solar, a solar panel installation company.

Use the following knowledge base documents to answer the customer's support ticket.
Be helpful, professional, and concise. If the knowledge base doesn't contain relevant information,
say so and provide general guidance.

KNOWLEDGE BASE:
{context}

CUSTOMER TICKET:
Name: {ticket.name}
Topic: {ticket.topic}
Issue: {ticket.description}

Please provide a helpful response to this customer:"""

    return TicketAnswer(
        ticket=TicketResponse.model_validate(ticket),
        answer=gemini_generate(prompt),
        sources=sources
    )
