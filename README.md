# AI Customer Support - Sunshine Solar

AI-powered customer support ticket system for Sunshine Solar. Uses Gemini for generating responses, Pinecone for semantic document search, and a React frontend.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database
- [Pinecone](https://www.pinecone.io/) account (free tier works)
- [Google AI Studio](https://aistudio.google.com/) API key (for Gemini)

## Project Structure

```
├── app/              # React + Vite frontend
├── backend/          # FastAPI backend
│   ├── main.py           # API routes
│   ├── database.py       # SQLAlchemy DB setup
│   ├── models.py         # DB models
│   ├── pinecone_setup.py # Pinecone vector DB setup
│   └── solar_data.json   # Company knowledge base data
```

## 1. Database Setup (PostgreSQL)

Install PostgreSQL if you don't have it, then create a database:

```bash
psql -U postgres
CREATE DATABASE ai_customer_support;
\q
```

The app auto-creates tables on startup via SQLAlchemy, so no manual migrations needed.

## 2. Pinecone Setup

1. Create a free account at [pinecone.io](https://www.pinecone.io/)
2. Go to **API Keys** in the Pinecone dashboard and copy your API key
3. The backend will automatically create a `solar-info` index (768 dimensions, cosine metric, serverless on AWS us-east-1) on first startup
4. On first startup, if the index is empty, it will automatically load the `solar_data.json` knowledge base into Pinecone

To manually reload the knowledge base into Pinecone at any time:

```bash
cd backend
python pinecone_setup.py
```

## 3. Gemini API Setup

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. This key is used for both embeddings (gemini-embedding-001) and text generation (gemini-3-flash-preview)

## 4. Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/ai_customer_support
PINECONE_API_KEY=your-pinecone-api-key
GEMINI_API_KEY=your-gemini-api-key
```

## 5. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Run the server:

```bash
python -m uvicorn main:app --reload
```

Backend runs at http://localhost:8000. API docs available at http://localhost:8000/docs.

## 6. Frontend Setup

```bash
cd app
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Running Both Together

You need two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd app
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/new-ticket` | Create a new support ticket |
| GET | `/api/tickets` | List all open tickets |
| DELETE | `/api/tickets/{id}` | Delete a ticket |
| GET | `/api/tickets/{id}/suggestions` | Get relevant docs for a ticket |
| GET | `/api/tickets/{id}/answer` | Generate AI answer for a ticket |
| POST | `/api/tickets/{id}/resolve` | Resolve ticket (solved or manual review) |
| POST | `/api/generate-ticket` | Generate a test ticket with AI |
| GET | `/api/solved-tickets` | List solved tickets |
| GET | `/api/manual-review-tickets` | List tickets needing manual review |
| POST | `/api/manual-review-tickets/{id}/solve` | Solve a manual review ticket |
| GET | `/api/search-docs` | Search knowledge base directly |
| GET | `/api/company-data` | Get all knowledge base documents |

## Troubleshooting

- **Database connection error**: Check your `DATABASE_URL` in `.env` and make sure PostgreSQL is running
- **Pinecone errors**: Verify your API key and that you haven't exceeded the free tier limits
- **Gemini errors**: Check that your `GEMINI_API_KEY` is valid and has access to the embedding and generation models
- **CORS errors**: The backend allows all origins by default. If you changed this, make sure your frontend URL is allowed
