import os
import numpy as np

from dotenv import load_dotenv

load_dotenv()

if not os.environ.get("OPENAI_API_KEY"):
    raise RuntimeError("OPENAI_API_KEY not found. Set it in .env or as an environment variable.")

from langchain_openai import OpenAIEmbeddings

# text-embedding-3-large Embedding Model
# gpt-5-mini LLM
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")


# Same idea, different wording → embeddings should be close (high cosine, small euclidean).
text_paraphrase_a = "Artificial intelligence is transforming the world."
text_paraphrase_b = "AI is changing how we live and work globally."

# Unrelated topic → should be far in embedding space (lower cosine, larger euclidean).
text_unrelated = "The recipe calls for flour, eggs, and dark chocolate."

vector1 = embeddings.embed_query(text_paraphrase_a)
vector2 = embeddings.embed_query(text_paraphrase_b)
vector3 = embeddings.embed_query(text_unrelated)

# print(f"Pharaphrase A: {vector1[:10]}")
# print(f"Pharaphrase B: {vector2[:10]}")
# print(f"Unrelated text: {vector3[:10]}")

def cosine_similarity(vector1, vector2):
    a, b = np.array(vector1), np.array(vector2)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def euclidean_distance(vector1, vector2):
    a, b = np.array(vector1), np.array(vector2)
    return np.linalg.norm(a - b)

print("Paraphrases (same meaning, different words):")
print(f"  A: {text_paraphrase_a}")
print(f"  B: {text_paraphrase_b}")
print("  Cosine similarity:", cosine_similarity(vector1, vector2))
print("  Euclidean distance:", euclidean_distance(vector1, vector2))

print("\nUnrelated topic (AI vs baking):")
print(f"  AI: {text_paraphrase_a}")
print(f"  Other: {text_unrelated}")
print("  Cosine similarity:", cosine_similarity(vector1, vector3))
print("  Euclidean distance:", euclidean_distance(vector1, vector3))