const modelInput = document.getElementById("modelInput");
const endpointInput = document.getElementById("endpointInput");
const paperInput = document.getElementById("paperInput");
const generateButton = document.getElementById("generateButton");
const sampleButton = document.getElementById("sampleButton");
const downloadButton = document.getElementById("downloadButton");
const statusText = document.getElementById("statusText");
const jsonOutput = document.getElementById("jsonOutput");
const diagramMount = document.getElementById("diagramMount");

const sampleText = `We propose a multimodal pipeline for pneumonia detection. Chest X-ray images are first normalized and passed into a convolutional encoder to extract visual features. Patient metadata including age, temperature, and oxygen saturation is transformed with a metadata encoder. The two embeddings are fused in a cross-attention fusion module and forwarded to a binary classifier. Low-confidence predictions are routed to a calibration module, which sends a refinement signal back to the fusion module before the final decision is produced.`;

const systemPrompt = `You convert research method text into a strict JSON diagram specification.

Return JSON only. Do not include markdown, code fences, or explanations.

Schema:
{
  "title": "short figure title",
  "nodes": [
    {
      "id": "n1",
      "label": "short node label",
      "type": "input | process | decision | output"
    }
  ],
  "edges": [
    {
      "from": "n1",
      "to": "n2",
      "label": "optional short label",
      "style": "solid | dashed"
    }
  ],
  "notes": ["optional note"]
}

Rules:
- Extract only the major stages needed to understand the pipeline.
- Keep labels short and professional.
- Use 4 to 8 nodes unless the text is extremely small.
- Preserve feedback loops if the text explicitly mentions them.
- Every edge endpoint must reference an existing node id.
- Always return valid JSON.`;

sampleButton.addEventListener("click", () => {
  paperInput.value = sampleText;
  setStatus("Sample loaded. You can generate now.", "success");
});

generateButton.addEventListener("click", async () => {
  const paperText = paperInput.value.trim();
  if (!paperText) {
    setStatus("Paste some research text first.", "error");
    return;
  }

  setBusy(true);
  setStatus("Generating structured figure with your local model...", "loading");

  try {
    const raw = await generateDiagramSpec({
      endpoint: endpointInput.value.trim(),
      model: modelInput.value.trim(),
      paperText
    });

    const spec = normalizeSpec(parseModelJson(raw));
    jsonOutput.textContent = JSON.stringify(spec, null, 2);
    renderDiagram(spec);
    downloadButton.disabled = false;
    setStatus("Figure generated successfully.", "success");
  } catch (error) {
    downloadButton.disabled = true;
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
});

downloadButton.addEventListener("click", () => {
  const svg = diagramMount.querySelector("svg");
  if (!svg) {
    setStatus("Generate a figure before downloading.", "error");
    return;
  }

  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "research-figure.svg";
  link.click();
  URL.revokeObjectURL(url);
});

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  sampleButton.disabled = isBusy;
  modelInput.disabled = isBusy;
  endpointInput.disabled = isBusy;
}

function setStatus(message, tone) {
  statusText.textContent = message;
  statusText.className = `status ${tone}`;
}

async function generateDiagramSpec({ endpoint, model, paperText }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\nResearch text:\n${paperText}`,
      stream: false,
      options: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}. Make sure Ollama is running and the model is installed.`);
  }

  const data = await response.json();
  if (!data.response) {
    throw new Error("The model returned an empty response.");
  }

  return data.response;
}

function parseModelJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (directError) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("The model response did not contain valid JSON. Try a stronger instruct model or adjust the prompt.");
    }

    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (sliceError) {
      throw new Error("The model returned malformed JSON. Try again or use a more reliable local model.");
    }
  }
}

function normalizeSpec(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Parsed output was not an object.");
  }

  const title = cleanLabel(spec.title || "Research Pipeline");
  const rawNodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const rawEdges = Array.isArray(spec.edges) ? spec.edges : [];
  const notes = Array.isArray(spec.notes) ? spec.notes.map(cleanLabel).filter(Boolean) : [];

  if (rawNodes.length < 2) {
    throw new Error("The model did not produce enough nodes to render a meaningful figure.");
  }

  const nodes = rawNodes.map((node, index) => {
    const id = typeof node.id === "string" && node.id.trim() ? node.id.trim() : `n${index + 1}`;
    return {
      id,
      label: cleanLabel(node.label || `Step ${index + 1}`),
      type: normalizeNodeType(node.type)
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map((edge) => ({
      from: typeof edge.from === "string" ? edge.from.trim() : "",
      to: typeof edge.to === "string" ? edge.to.trim() : "",
      label: cleanLabel(edge.label || ""),
      style: edge.style === "dashed" ? "dashed" : "solid"
    }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

  if (!edges.length) {
    throw new Error("The model output had no valid edges between extracted nodes.");
  }

  return { title, nodes, edges, notes };
}

function normalizeNodeType(type) {
  const safe = typeof type === "string" ? type.trim().toLowerCase() : "";
  const supported = ["input", "process", "decision", "output"];
  return supported.includes(safe) ? safe : "process";
}

function cleanLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/["`]/g, "")
    .trim();
}

function renderDiagram(spec) {
  const layout = computeLayout(spec.nodes);
  const width = 980;
  const height = Math.max(360, layout.totalHeight + 120);

  const defs = `
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#17313e"></path>
      </marker>
      <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="rgba(38, 39, 40, 0.18)"></feDropShadow>
      </filter>
    </defs>
  `;

  const edgesSvg = spec.edges.map((edge) => buildEdge(edge, layout.positions)).join("");
  const nodesSvg = spec.nodes.map((node) => buildNode(node, layout.positions[node.id])).join("");
  const notesSvg = buildNotes(spec.notes, width, height);

  diagramMount.classList.remove("empty");
  diagramMount.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(spec.title)}">
      ${defs}
      <rect x="0" y="0" width="${width}" height="${height}" rx="28" fill="#fffdf9"></rect>
      <text x="48" y="58" font-size="28" font-weight="700" fill="#17313e">${escapeXml(spec.title)}</text>
      ${edgesSvg}
      ${nodesSvg}
      ${notesSvg}
    </svg>
  `;
}

function computeLayout(nodes) {
  const boxWidth = 260;
  const boxHeight = 82;
  const centerX = 490;
  const startY = 110;
  const gapY = 40;
  const positions = {};

  nodes.forEach((node, index) => {
    positions[node.id] = {
      x: centerX - boxWidth / 2,
      y: startY + index * (boxHeight + gapY),
      width: boxWidth,
      height: boxHeight
    };
  });

  return {
    positions,
    totalHeight: startY + nodes.length * boxHeight + Math.max(0, nodes.length - 1) * gapY
  };
}

function buildNode(node, position) {
  const fillByType = {
    input: "#fef1d5",
    process: "#fff4eb",
    decision: "#eaf4ff",
    output: "#e9f8ef"
  };

  const strokeByType = {
    input: "#d69f32",
    process: "#d6663f",
    decision: "#4f8ac8",
    output: "#47a36d"
  };

  const fill = fillByType[node.type] || fillByType.process;
  const stroke = strokeByType[node.type] || strokeByType.process;
  const lines = wrapText(node.label, 26);

  const textSvg = lines
    .map((line, index) => {
      const dy = position.y + 34 + index * 18;
      return `<text x="${position.x + position.width / 2}" y="${dy}" text-anchor="middle" font-size="16" font-weight="600" fill="#17313e">${escapeXml(line)}</text>`;
    })
    .join("");

  return `
    <g filter="url(#cardShadow)">
      <rect
        x="${position.x}"
        y="${position.y}"
        width="${position.width}"
        height="${position.height}"
        rx="20"
        fill="${fill}"
        stroke="${stroke}"
        stroke-width="2"
      ></rect>
    </g>
    ${textSvg}
  `;
}

function buildEdge(edge, positions) {
  const from = positions[edge.from];
  const to = positions[edge.to];
  if (!from || !to) {
    return "";
  }

  const isForward = to.y > from.y;
  const x1 = from.x + from.width / 2;
  const y1 = isForward ? from.y + from.height : from.y;
  const x2 = to.x + to.width / 2;
  const y2 = isForward ? to.y : to.y + to.height;
  const dashed = edge.style === "dashed";
  const isLoop = !isForward;

  let path = `M ${x1} ${y1} L ${x2} ${y2}`;
  let labelX = (x1 + x2) / 2;
  let labelY = (y1 + y2) / 2 - 8;

  if (isLoop) {
    const offset = 180;
    path = [
      `M ${x1} ${from.y}`,
      `C ${x1 + offset} ${from.y - 18}, ${x2 + offset} ${to.y + to.height + 18}, ${x2} ${to.y + to.height}`
    ].join(" ");
    labelX = x1 + offset - 26;
    labelY = (from.y + to.y + to.height) / 2;
  }

  const label = edge.label
    ? `<text x="${labelX}" y="${labelY}" font-size="13" font-weight="600" fill="#5d6f75">${escapeXml(edge.label)}</text>`
    : "";

  return `
    <path
      d="${path}"
      fill="none"
      stroke="#17313e"
      stroke-width="2.5"
      stroke-dasharray="${dashed ? "8 6" : "0"}"
      marker-end="url(#arrow)"
    ></path>
    ${label}
  `;
}

function buildNotes(notes, width, height) {
  if (!notes.length) {
    return "";
  }

  const titleY = height - 60;
  const bodyY = height - 34;
  return `
    <text x="${width - 290}" y="${titleY}" font-size="14" font-weight="700" fill="#17313e">Notes</text>
    <text x="${width - 290}" y="${bodyY}" font-size="13" fill="#5d6f75">${escapeXml(notes.join(" | "))}</text>
  `;
}

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
