import getpass # module to get the API key from the user
import os # module to set the environment variable for the API key
import json # module to convert the output to JSON
from openai import OpenAI # module to create the client to call the LLM
from pydantic import BaseModel # module to define the structured output
from datetime import datetime # module to get the current date


# define the structured output model
class CalendarEvent(BaseModel):
    name: str 
    date: str
    participants: list[str]

# To get more information about this model: https://developers.openai.com/api/docs/models/gpt-5-mini
MODEL = "gpt-5-mini-2025-08-07"
SYSTEM_PROMPT = """
Extract the event information. 
Considerations:
- If there is no date defined, set the date to today.
- The date should be in the format DD/MM/YYYY."""

DEFAULT_USER_PROMPT = "Alice and Bob are going to a science fair on Friday."

# Define a list of callable tools for the model
TOOLS = [
    {
        "type": "function",
        "name": "get_current_date",
        "description": "Get the current date in the format DD/MM/YYYY and the timezone is CST",
        "parameters": {} # no parameters are needed for this tool
    }
]

def get_current_date():
    print("Getting the current date locally...")
    return datetime.now().strftime("%d/%m/%Y")

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
    inputs = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": input_prompt
        },
    ]
    response = client.responses.parse(
        model=MODEL,
        tools=TOOLS,
        tool_choice="auto", # auto-select the tool to use
        input=inputs
    )

    # Save function call outputs for subsequent requests
    inputs += response.output

    for item in response.output:
        if item.type == "function_call":
            if item.name == "get_current_date":
                # Execute the function logic for get_current_date
                current_date = get_current_date()
                
                # Provide function call results to the model
                inputs.append({
                    "type": "function_call_output",
                    "call_id": item.call_id,
                    "output": json.dumps({
                    "current_date": current_date
                    })
                })

    response = client.responses.parse(
        model=MODEL,
        tools=TOOLS,
        tool_choice="auto", # auto-select the tool to use
        input=inputs,
        text_format=CalendarEvent,
    )

    event = response.output_parsed
    print(f"The name of the event is: {event.name}")
    print(f"The date of the event is: {event.date}")
    print(f"The participants of the event are: {event.participants}")
    
# run the main function
main()
