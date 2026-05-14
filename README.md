# Research Figure Generator

A zero-cost GenAI MVP that turns research text into a structured figure using a local Ollama model.

## What it solves

Researchers often spend time manually converting method descriptions into diagrams for papers, slides, or reports. This project reduces that friction by:

- extracting the main pipeline stages from research text
- converting them into a strict JSON schema
- rendering a downloadable SVG figure locally

## Why this is good for interviews

This project shows:

- practical GenAI usage without paid APIs
- structured output design instead of raw chatbot answers
- prompt engineering for faithfulness and brevity
- product thinking around explainability and exportable results

Interview-safe framing:

> Inspired by research systems like Google Research's PaperVizAgent, I built a zero-cost MVP that uses a local LLM to convert paper text into structured pipeline figures.

## Zero-cost stack

- Frontend: plain HTML, CSS, and JavaScript
- Model runtime: [Ollama](https://ollama.com/)
- Model suggestions:
  - `qwen2.5:7b-instruct`
  - `llama3.1:8b`
  - `mistral`
- Figure renderer: custom SVG, no paid image API

## How it works

1. Paste a paper abstract or method section.
2. The app sends the text to a local Ollama model.
3. The model returns strict JSON with `nodes`, `edges`, and `notes`.
4. The app validates that JSON and renders an SVG figure.

## Project structure

- [index.html](C:\Users\shoai\Documents\Codex\2026-05-12\can-you-give-me-a-repo\index.html)
- [styles.css](C:\Users\shoai\Documents\Codex\2026-05-12\can-you-give-me-a-repo\styles.css)
- [app.js](C:\Users\shoai\Documents\Codex\2026-05-12\can-you-give-me-a-repo\app.js)

## Run locally

You can open `index.html` directly, but using a simple local server is safer for browser fetch behavior.

### Option 1: Python server

```powershell
python -m http.server 8000
```

Then open:

[http://localhost:8000](http://localhost:8000)

### Option 2: VS Code Live Server

Serve the folder and open the generated local URL.

## Ollama setup

Install Ollama, then pull a local instruct model:

```powershell
ollama pull qwen2.5:7b-instruct
ollama serve
```

The app defaults to:

`http://localhost:11434/api/generate`

## Deploy on Vercel as-is

This project can be deployed to Vercel as a static frontend without adding a backend.

Important limitation:

- the UI will load for anyone
- figure generation only works for users who already have `Ollama` running locally
- the app still calls `http://localhost:11434/api/generate`, which points to the visitor's own machine

### Deploy steps

1. Push the project to a GitHub repository.
2. Import the repository into Vercel.
3. Keep it as a static project with no framework preset required.
4. Deploy.

After deployment, users can open the site URL, but they must also do this on their own machine:

```powershell
ollama pull qwen2.5:7b-instruct
ollama serve
```

Then they can use the deployed frontend with their local Ollama runtime.

## Suggested demo flow

Use a method paragraph like:

```text
We propose a multimodal pipeline for pneumonia detection. Chest X-ray images are first normalized and passed into a convolutional encoder to extract visual features. Patient metadata including age, temperature, and oxygen saturation is transformed with a metadata encoder. The two embeddings are fused in a cross-attention fusion module and forwarded to a binary classifier. Low-confidence predictions are routed to a calibration module, which sends a refinement signal back to the fusion module before the final decision is produced.
```

Then explain the output in interviews:

- the local model extracts core steps
- the app normalizes them into a diagram schema
- the SVG renderer turns them into a usable figure
- the architecture is easy to extend with a critic pass or model benchmarking

## Smart next steps

- add a critic pass with the same local model
- support Mermaid export alongside SVG
- benchmark multiple Ollama models on latency and faithfulness
- allow manual node editing before final export
