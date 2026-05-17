# Research Figure Generator

A zero-cost GenAI MVP that turns research text into a styled academic figure using a local Ollama model.

Live site: [https://research-figure-generator.vercel.app/](https://research-figure-generator.vercel.app/)

## What it solves

Researchers often spend time manually converting method descriptions into diagrams for papers, slides, or reports. This project reduces that friction by:

- extracting the main pipeline stages from research text
- converting them into a strict JSON schema
- grouping stages into sections
- rendering a downloadable SVG or PNG figure locally
## Live demo

Open the deployed app here:

[https://research-figure-generator.vercel.app/](https://research-figure-generator.vercel.app/)

Important:

- the website is hosted on Vercel
- figure generation still requires a user-local Ollama runtime
- the hosted frontend calls the visitor's own Ollama endpoint

## Zero-cost stack

- Frontend: plain HTML, CSS, and JavaScript
- Model runtime: [Ollama](https://ollama.com/)
- Model suggestions:
  - `qwen2.5:7b-instruct`
  - `llama3.1:8b`
  - `mistral`
- Figure renderer: custom SVG and PNG export, no paid image API

## How it works

1. Paste a paper abstract or method section.
2. The app sends the text to a local Ollama model.
3. The model returns strict JSON with `nodes`, `edges`, `sections`, and a caption.
4. The app validates that JSON, chooses a layout, and renders a styled figure.

## What changed in the upgraded renderer

- layout-aware figures instead of one plain vertical flowchart
- support for horizontal pipelines, multimodal layouts, and feedback-loop diagrams
- automatic figure sections for cleaner grouping
- paper-style caption output under the figure
- PNG export in addition to SVG export

## Project structure

- [index.html](C:\Users\shoai\Documents\Codex\2026-05-12\can-you-give-me-a-repo\index.html)
- [styles.css](C:\Users\shoai\Documents\Codex\2026-05-12\can-you-give-me-a-repo\styles.css)
- [app.js](C:\Users\shoai\Documents\Codex\2026-05-12\can-you-give-me-a-repo\app.js)

## Ollama setup

To use figure generation from the live website, install Ollama and pull a local instruct model:

```powershell
ollama pull qwen2.5:7b-instruct
ollama serve
```

The website expects Ollama at:

`http://localhost:11434/api/generate`

## How to use the deployed site

1. Open [https://research-figure-generator.vercel.app/](https://research-figure-generator.vercel.app/)
2. Make sure Ollama is running on your machine
3. Keep the default endpoint as `http://localhost:11434/api/generate`
4. Enter the model name, such as `qwen2.5:7b-instruct`
5. Paste research text or use the sample
6. Generate the figure and export it as SVG or PNG

## Suggested demo flow

Use a method paragraph like:

```text
We propose a multimodal pipeline for pneumonia detection. Chest X-ray images are first normalized and passed into a convolutional encoder to extract visual features. Patient metadata including age, temperature, and oxygen saturation is transformed with a metadata encoder. The two embeddings are fused in a cross-attention fusion module and forwarded to a binary classifier. Low-confidence predictions are routed to a calibration module, which sends a refinement signal back to the fusion module before the final decision is produced.
```

## Smart next steps

- add a critic pass with the same local model
- support Mermaid export alongside SVG
- benchmark multiple Ollama models on latency and faithfulness
- allow manual node editing before final export


