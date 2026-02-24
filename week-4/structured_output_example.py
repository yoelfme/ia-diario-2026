import getpass # module to get the API key from the user
import os # module to set the environment variable for the API key
from openai import OpenAI # module to create the client to call the LLM
from pydantic import BaseModel # module to define the structured output

# define the structured output model
class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

# To get more information about this model: https://developers.openai.com/api/docs/models/gpt-5-mini
MODEL = "gpt-5-mini-2025-08-07"
SYSTEM_PROMPT = """
Extract the event information. 
If there is no date defined, set the date to today."""

DEFAULT_USER_PROMPT = "Alice and Bob are going to a science fair on Friday."

def main():
    # get the API key from the user
    api_key = getpass.getpass("Enter your OpenAI API key: ")
    os.environ["OPENAI_API_KEY"] = api_key

    # get the input prompt from the user
    input_prompt = input(f"Enter your prompt or press enter to use the default prompt: {DEFAULT_USER_PROMPT}: ")
    if input_prompt == "":
        input_prompt = DEFAULT_USER_PROMPT

    # create the client to call the LLM
    client = OpenAI() 
    response = client.responses.parse(
        model=MODEL,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": input_prompt
            },
        ],
        text_format=CalendarEvent,
    )

    event = response.output_parsed
    print(f"The name of the event is: {event.name}")
    print(f"The date of the event is: {event.date}")
    print(f"The participants of the event are: {event.participants}")
    
# run the main function
main()
