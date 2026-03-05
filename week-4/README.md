# Structred Outputs

## Requirements

- uv
- Python 3.12

## Setup

- Create a new directory: `week-4`
- Run `uv init -p 3.12 .`
    - `-p` defines the Python
- Run `uv venv -p 3.12`
- Enable the virtual environment: `source .venv/bin/activate`
- Install dependencies: `uv pip install openai pydantic requests`
- Run the script: `uv run --active <file>`
    - For the structured output example: `uv run --active structured_output_example.py`
    - For the tool calling example: `uv run --active tool_calling_example.py`
    - For the inventory/order tool calling example: `uv run --active inventory_tool_calling_example.py`
        - Requires inventory API at `http://localhost:3001` and orders API at `http://localhost:3000` to be running
