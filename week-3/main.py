import os # for environment variables
import getpass # for getting the user's API key

# for initializing the chat model, which is a wrapper around the OpenAI API
from langchain.chat_models import init_chat_model

# set the OpenAI API key
os.environ["OPENAI_API_KEY"] = getpass.getpass("Enter your OpenAI API key: ")

# initialize the chat model, which is a wrapper around the OpenAI API
model = init_chat_model("gpt-4.1") 
# invoke the model with a message
response = model.invoke(input("Enter a message: "))
print("Response:")
print(response.content)

print("Metadata:")
print(response.response_metadata)