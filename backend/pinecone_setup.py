import json
import os
from dotenv import load_dotenv
from pinecone import Pinecone
from fastembed import TextEmbedding

load_dotenv()

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Initialize the embedding model
model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")

INDEX_NAME = "solar-info"


def get_or_create_index():
    """Get existing index or create a new one"""
    existing_indexes = [idx.name for idx in pc.list_indexes()]

    if INDEX_NAME not in existing_indexes:
        pc.create_index(
            name=INDEX_NAME,
            dimension=384,  # all-MiniLM-L6-v2 outputs 384 dimensions
            metric="cosine",
            spec={"serverless": {"cloud": "aws", "region": "us-east-1"}}
        )

    return pc.Index(INDEX_NAME)


index = get_or_create_index()


def load_solar_data():
    """Load solar_data.json into Pinecone, replacing all existing data"""
    # Clear all existing vectors first
    index.delete(delete_all=True)
    print("Cleared existing data from index")

    with open("solar_data.json", "r") as f:
        data = json.load(f)

    # Prepare vectors for upsert
    vectors = []
    for item in data:
        embedding = list(model.embed([item["content"]]))[0].tolist()
        vectors.append({
            "id": str(item["id"]),
            "values": embedding,
            "metadata": {
                "category": item["category"],
                "document_title": item["document_title"],
                "content": item["content"]
            }
        })

    # Upsert in batches
    index.upsert(vectors=vectors)
    print(f"Loaded {len(data)} documents into Pinecone")


def query_docs(query_text: str, n_results: int = 3):
    """Query Pinecone for relevant documents"""
    query_embedding = list(model.embed([query_text]))[0].tolist()

    results = index.query(
        vector=query_embedding,
        top_k=n_results,
        include_metadata=True
    )

    # Format results to match the expected structure
    documents = []
    metadatas = []
    distances = []

    for match in results.matches:
        documents.append(match.metadata["content"])
        metadatas.append({
            "category": match.metadata["category"],
            "document_title": match.metadata["document_title"]
        })
        # Convert cosine similarity to distance (1 - similarity)
        distances.append(1 - match.score)

    return {
        "documents": [documents],
        "metadatas": [metadatas],
        "distances": [distances]
    }


if __name__ == "__main__":
    load_solar_data()

    # Test query
    print("\nTest query: 'inverter red light error'")
    results = query_docs("inverter red light error")
    for i, doc in enumerate(results["documents"][0]):
        print(f"\n--- Result {i+1} ---")
        print(f"Category: {results['metadatas'][0][i]['category']}")
        print(f"Content: {doc[:200]}...")
