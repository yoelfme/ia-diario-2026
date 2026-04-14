from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector

from dotenv import load_dotenv

# load environment variables from .env file
load_dotenv()

file_path = "./docs/codigo-civil.pdf"

loader = PyPDFLoader(file_path)

# carga el PDF
docs = loader.load() # [Document, Document, Document]

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000, chunk_overlap=200, add_start_index=True
)
all_splits = text_splitter.split_documents(docs)

print(f"Total pages: {len(docs)}")
print(f"Total chunks: {len(all_splits)}")

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

vector_store = PGVector(
    embeddings=embeddings,
    collection_name="codigos_de_guatemala",
    connection="postgresql+psycopg://postgres:postgres@localhost:5432/agentdb",
)

# Store documents in the vector store   
ids = vector_store.add_documents(documents=all_splits)