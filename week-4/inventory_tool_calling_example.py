import getpass
import os
import json
import requests
from openai import OpenAI

INVENTORY_URL = "http://localhost:3001/inventory"
ORDERS_URL = "http://localhost:3000/orders"
FLOW_ID = "001"

MODEL = "gpt-5-mini-2025-08-07"
SYSTEM_PROMPT = """
Eres un asistente de inventario y pedidos. Puedes:
- Consultar la disponibilidad de productos por SKU
- Crear órdenes de productos (el sistema valida la disponibilidad automáticamente)

Consideraciones:
- Siempre verifica el inventario antes de crear una orden si el usuario quiere ordenar algo.
- Responde en español de forma clara y concisa.
"""

DEFAULT_USER_PROMPT = "Quiero ordenar 2 unidades del SKU-123"

TOOLS = [
    {
        "type": "function",
        "name": "check_inventory",
        "description": "Consultar la disponibilidad de un producto por su SKU",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": "string",
                    "description": "El SKU del producto (ej: SKU-123)",
                },
            },
            "required": ["sku"],
        },
    },
    {
        "type": "function",
        "name": "create_order",
        "description": "Crear una orden para un producto. Valida la disponibilidad automáticamente.",
        "parameters": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": "string",
                    "description": "El SKU del producto",
                },
                "quantity": {
                    "type": "integer",
                    "description": "La cantidad a ordenar",
                },
            },
            "required": ["sku", "quantity"],
        },
    },
]


def check_inventory(sku: str) -> dict:
    """GET inventory availability for a SKU."""
    try:
        response = requests.get(f"{INVENTORY_URL}/{sku}", timeout=10)
        return {"status_code": response.status_code, "data": response.json()}
    except requests.RequestException as e:
        return {"error": str(e)}
    except json.JSONDecodeError:
        return {"status_code": response.status_code, "data": response.text}


def create_order(sku: str, quantity: int) -> dict:
    """POST to create an order. API validates availability."""
    try:
        response = requests.post(
            ORDERS_URL,
            json={"sku": sku, "quantity": quantity},
            headers={"Content-Type": "application/json", "x-flow-id": FLOW_ID},
            timeout=10,
        )
        return {"status_code": response.status_code, "data": response.json()}
    except requests.RequestException as e:
        return {"error": str(e)}
    except json.JSONDecodeError:
        return {"status_code": response.status_code, "data": response.text}


def main():
    api_key = getpass.getpass("Enter your OpenAI API key: ")
    os.environ["OPENAI_API_KEY"] = api_key

    input_prompt = input(
        f"Enter your prompt or press enter to use the default: {DEFAULT_USER_PROMPT}: "
    )
    if input_prompt == "":
        input_prompt = DEFAULT_USER_PROMPT

    client = OpenAI()
    inputs = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": input_prompt},
    ]

    while True:
        response = client.responses.create(
            model=MODEL,
            tools=TOOLS,
            tool_choice="auto",
            input=inputs,
        )

        inputs += response.output

        has_function_calls = False
        for item in response.output:
            if item.type == "function_call":
                has_function_calls = True
                args = json.loads(item.arguments) if getattr(item, "arguments", None) else {}

                if item.name == "check_inventory":
                    result = check_inventory(args.get("sku", ""))
                    inputs.append({
                        "type": "function_call_output",
                        "call_id": item.call_id,
                        "output": json.dumps(result),
                    })
                elif item.name == "create_order":
                    result = create_order(
                        args.get("sku", ""),
                        args.get("quantity", 0),
                    )
                    inputs.append({
                        "type": "function_call_output",
                        "call_id": item.call_id,
                        "output": json.dumps(result),
                    })

        if not has_function_calls:
            break

    print(response.output_text)


if __name__ == "__main__":
    main()
