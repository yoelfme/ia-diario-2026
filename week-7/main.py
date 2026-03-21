import os
import numpy as np

from dotenv import load_dotenv

load_dotenv()

if not os.environ.get("OPENAI_API_KEY"):
    raise RuntimeError("OPENAI_API_KEY not found. Set it in .env or as an environment variable.")

from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")


vector1 = embeddings.embed_query("Hello, world!")
vector2 = embeddings.embed_query("Hello, world!")
vector3 = embeddings.embed_query("Machine learning and artificial intelligence")

def cosine_similarity(vector1, vector2):
    a, b = np.array(vector1), np.array(vector2)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def euclidean_distance(vector1, vector2):
    a, b = np.array(vector1), np.array(vector2)
    return np.linalg.norm(a - b)

# Same text → cosine ≈ 1, euclidean ≈ 0
print("Same text:")
print("  Cosine similarity:", cosine_similarity(vector1, vector2))
print("  Euclidean distance:", euclidean_distance(vector1, vector2))

# Different text → cosine < 1, euclidean > 0
print("\nDifferent texts (vs 'Machine learning and AI'):")
print("  Cosine similarity:", cosine_similarity(vector1, vector3))
print("  Euclidean distance:", euclidean_distance(vector1, vector3))