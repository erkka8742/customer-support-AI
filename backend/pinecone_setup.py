import json
import os
from dotenv import load_dotenv
from pinecone import Pinecone
from google import genai
from google.genai import types

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
gemini_client = genai.Client()

INDEX_NAME = "solar-info"
DIMENSION = 768


def get_embedding(text: str) -> list:
    response = gemini_client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=768)
    )
    return response.embeddings[0].values


def get_or_create_index():
    existing = {idx.name: idx for idx in pc.list_indexes()}

    # Recreate if dimension mismatch
    if INDEX_NAME in existing:
        if existing[INDEX_NAME].dimension != DIMENSION:
            pc.delete_index(INDEX_NAME)
            existing = {}

    if INDEX_NAME not in existing:
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIMENSION,
            metric="cosine",
            spec={"serverless": {"cloud": "aws", "region": "us-east-1"}}
        )

    return pc.Index(INDEX_NAME)


index = get_or_create_index()


def load_solar_data():
    try:
        index.delete(delete_all=True)
        print("Cleared existing data from index")
    except Exception:
        print("Index namespace empty, skipping clear")

    with open("solar_data.json", "r") as f:
        data = json.load(f)

    vectors = []
    for item in data:
        embedding = get_embedding(item["content"])
        vectors.append({
            "id": str(item["id"]),
            "values": embedding,
            "metadata": {
                "category": item["category"],
                "document_title": item["document_title"],
                "content": item["content"]
            }
        })

    index.upsert(vectors=vectors)
    print(f"Loaded {len(data)} documents into Pinecone")


def query_docs(query_text: str, n_results: int = 3):
    query_embedding = get_embedding(query_text)

    results = index.query(
        vector=query_embedding,
        top_k=n_results,
        include_metadata=True
    )

    documents, metadatas, distances = [], [], []
    for match in results.matches:
        documents.append(match.metadata["content"])
        metadatas.append({
            "category": match.metadata["category"],
            "document_title": match.metadata["document_title"]
        })
        distances.append(1 - match.score)

    return {
        "documents": [documents],
        "metadatas": [metadatas],
        "distances": [distances]
    }


if __name__ == "__main__":
    load_solar_data()
