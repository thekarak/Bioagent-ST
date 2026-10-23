import json
import urllib.request
from typing import Any, cast


class OllamaClient:
    def __init__(self, model: str, endpoint: str = "http://localhost:11434") -> None:
        self.model = model
        self.endpoint = endpoint.rstrip("/")

    def generate_plan(self, question: str, context: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0},
            "messages": [
                {
                    "role": "system",
                    "content": "Return only a JSON analysis plan using registered tools.",
                },
                {
                    "role": "user",
                    "content": json.dumps({"question": question, "context": context}),
                },
            ],
        }
        request = urllib.request.Request(
            f"{self.endpoint}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["message"]["content"]
        return cast(dict[str, Any], json.loads(content))
