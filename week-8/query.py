from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector

from dotenv import load_dotenv

# load environment variables from .env file
load_dotenv()

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vector_store = PGVector(
    embeddings=embeddings,
    collection_name="codigo_de_trabajo_guatemala",
    connection="postgresql+psycopg://postgres:postgres@localhost:5432/week_8",
)

# query the vector store
query = "¿Qué normas especiales existen para el trabajo femenino y infantil?"

results = vector_store.similarity_search(query=query)



print(results)