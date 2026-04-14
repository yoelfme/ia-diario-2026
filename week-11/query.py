from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector

from dotenv import load_dotenv

# load environment variables from .env file
load_dotenv()

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vector_store = PGVector(
    embeddings=embeddings,
    collection_name="codigos_de_guatemala",
    connection="postgresql+psycopg://postgres:postgres@localhost:5432/agentdb",
)

# query the vector store
query = input("Ingresa tu consulta: ")

results = vector_store.similarity_search(query=query)



print(results)