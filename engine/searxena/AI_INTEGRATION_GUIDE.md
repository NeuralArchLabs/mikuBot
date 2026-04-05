# searXena AI Integration Guide: High-Performance Data Infrastructure

This guide documents how Artificial Intelligence Models (LLMs, Agents, Code Assistants) can interact with **searXena** natively using tool calling and its JSON API.

## 🚀 The Advantage: Zero Friction, Zero API Keys

Historically, providing real-time web access to an AI agent involved managing commercial search providers, credit limits, and subscription tiers. **searXena changes this paradigm**:

1.  **Stop Managing Keys:** You no longer need to manage multiple API keys or secret rotations.
2.  **Infinite Scaling:** Since it runs on your own hardware, you don't pay per query. Scale your research to thousands of requests without hitting commercial bills.
3.  **Local Latency:** Data processing happens on your node, delivering structured signals directly to your agent.

## Available Endpoints

searXena provides structured endpoints under the `/api/v1/` path designed strictly for JSON responses without any HTML/CSS overhead:

### 1. Tool Schema (`GET /api/v1/tools_schema`)

Returns a JSON object aligned with OpenAI, Anthropic, and Gemini standards for tool/function definitions.

**Example usage:**
```bash
curl -X GET http://localhost:8000/api/v1/tools_schema
```

### 2. Structured Search (`POST /api/v1/search`)

This is the endpoint where your LLM will send its "Tool Call". It returns an object with results and context metadata.

**Request Body Parameters:**

| Parameter         | Type       | Required | Description |
|-------------------|------------|-----------|-------------|
| `query`           | `string`   | **Yes**   | The search query. |
| `category`        | `string`   | No        | `general` (default), `it`, `news`, `shopping`, `images`, `videos`. |
| `pageno`          | `integer`  | No        | Page number. Default `1`. |
| `language`        | `string`   | No        | ISO code: `es`, `en`, `zh`, etc. |
| `limit`           | `integer`  | No        | Maximum results. Default `10`. |

## Agent Recommendations (System Prompt)

To optimize the use of searXena, instruct your model with the following:

1.  **Content Extraction (O-ZEN Engine):** searXena uses the native **O-ZEN** engine to process web content, removing ads and visual noise to deliver only relevant information to your model.
2.  **Categorical Precision:** Use `category: "it"` for technical topics and `category: "news"` for recent events.
3.  **Context Management:** Observe the `meta.has_more` property. If you need to go deeper, re-run the search by increasing the `limit` or `pageno`.
4.  **Anti-Hallucination Ranking:** searXena's heuristic filter prioritizes high-quality sources (e.g., documentation, wikis, community repositories) and hides marketing-heavy results.

## Quick Integration (Python)

```python
import httpx

def search_locally(query: str, category: str = "general", limit: int = 10):
    url = "http://localhost:8000/api/v1/search"
    payload = {"query": query, "category": category, "limit": limit}
    # No API Key needed! Just your local searXena instance.
    return httpx.post(url, json=payload).json()

# Example: Technical research for an AI Agent
results = search_locally("Agentic workflows best practices", category="it")
print(f"Agent's Context: {results['results'][0]['content']}")
```

---
<div align="center">
  Empowering local intelligence with private web data.
</div>
