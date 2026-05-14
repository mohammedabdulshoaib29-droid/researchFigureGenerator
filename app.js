const modelInput = document.getElementById("modelInput");
const endpointInput = document.getElementById("endpointInput");
const paperInput = document.getElementById("paperInput");
const generateButton = document.getElementById("generateButton");
const sampleButton = document.getElementById("sampleButton");
const downloadButton = document.getElementById("downloadButton");
const downloadPngButton = document.getElementById("downloadPngButton");
const statusText = document.getElementById("statusText");
const jsonOutput = document.getElementById("jsonOutput");
const diagramMount = document.getElementById("diagramMount");
const figureMeta = document.getElementById("figureMeta");
const layoutValue = document.getElementById("layoutValue");
const captionValue = document.getElementById("captionValue");

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
  "sections": [
    {
      "id": "s1",
      "label": "section label",
      "nodeIds": ["n1", "n2"]
    }
  ],
  "notes": ["optional note"],
  "caption": "one sentence figure caption"
}

Rules:
- Extract only the major stages needed to understand the pipeline.
- Keep labels short and professional.
- Use 4 to 8 nodes unless the text is extremely small.
- Preserve feedback loops if the text explicitly mentions them.
- Group related nodes into 2 to 4 meaningful sections when possible.
- Write a concise academic-style figure caption.
- Every edge endpoint must reference an existing node id.
- Always return valid JSON.`;

let lastRenderedSvg = "";

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
    downloadPngButton.disabled = false;
    setStatus("Figure generated successfully.", "success");
  } catch (error) {
    downloadButton.disabled = true;
    downloadPngButton.disabled = true;
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

downloadPngButton.addEventListener("click", async () => {
  const svg = diagramMount.querySelector("svg");
  if (!svg) {
    setStatus("Generate a figure before downloading.", "error");
    return;
  }

  try {
    await downloadSvgAsPng(svg, "research-figure.png");
    setStatus("PNG exported successfully.", "success");
  } catch (error) {
    setStatus("PNG export failed. Try SVG export instead.", "error");
  }
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
  const rawSections = Array.isArray(spec.sections) ? spec.sections : [];
  const notes = Array.isArray(spec.notes) ? spec.notes.map(cleanLabel).filter(Boolean) : [];
  const caption = cleanLabel(spec.caption || "");

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

  let sections = rawSections
    .map((section, index) => ({
      id: typeof section.id === "string" && section.id.trim() ? section.id.trim() : `s${index + 1}`,
      label: cleanLabel(section.label || `Section ${index + 1}`),
      nodeIds: Array.isArray(section.nodeIds)
        ? section.nodeIds.map((id) => String(id).trim()).filter((id) => nodeIds.has(id))
        : []
    }))
    .filter((section) => section.nodeIds.length);

  if (!sections.length) {
    sections = inferSections(nodes);
  }

  const layout = detectLayout(nodes, edges, sections);

  return {
    title,
    nodes,
    edges,
    sections,
    notes,
    caption: caption || buildCaption(title, sections, notes),
    layout
  };
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
  const scene = buildScene(spec);

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

  const sectionsSvg = scene.sections.map((section) => buildSection(section)).join("");
  const edgesSvg = spec.edges.map((edge) => buildEdge(edge, scene.positions, scene.layout.kind)).join("");
  const nodesSvg = spec.nodes.map((node) => buildNode(node, scene.positions[node.id])).join("");
  const notesSvg = buildNotes(spec.notes, scene.width, scene.height);
  const captionSvg = buildCaptionText(spec.caption, scene.width, scene.height);

  diagramMount.classList.remove("empty");
  lastRenderedSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="${escapeXml(spec.title)}">
      ${defs}
      <rect x="0" y="0" width="${scene.width}" height="${scene.height}" rx="28" fill="#fffdf9"></rect>
      <rect x="34" y="34" width="${scene.width - 68}" height="${scene.height - 68}" rx="24" fill="rgba(248, 241, 231, 0.6)" stroke="rgba(23, 49, 62, 0.08)"></rect>
      <text x="48" y="58" font-size="28" font-weight="700" fill="#17313e">${escapeXml(spec.title)}</text>
      <text x="${scene.width - 48}" y="58" text-anchor="end" font-size="13" font-weight="700" fill="#b94d2d">${escapeXml(formatLayoutLabel(spec.layout.kind))}</text>
      ${sectionsSvg}
      ${edgesSvg}
      ${nodesSvg}
      ${notesSvg}
      ${captionSvg}
    </svg>
  `;
  diagramMount.innerHTML = lastRenderedSvg;

  figureMeta.classList.remove("empty");
  layoutValue.textContent = formatLayoutLabel(spec.layout.kind);
  captionValue.textContent = spec.caption;
}

function inferSections(nodes) {
  const sectionMap = {
    input: "Inputs",
    process: "Model Pipeline",
    decision: "Decision Logic",
    output: "Outputs"
  };
  const grouped = new Map();

  nodes.forEach((node) => {
    const label = sectionMap[node.type] || "Pipeline";
    if (!grouped.has(label)) {
      grouped.set(label, []);
    }
    grouped.get(label).push(node.id);
  });

  return Array.from(grouped.entries()).map(([label, nodeIds], index) => ({
    id: `s${index + 1}`,
    label,
    nodeIds
  }));
}

function detectLayout(nodes, edges, sections) {
  const hasLoop = edges.some((edge) => edge.style === "dashed" || comesEarlier(edge.from, edge.to, nodes));
  const inputCount = nodes.filter((node) => node.type === "input").length;
  const sectionCount = sections.length;

  if (inputCount >= 2 && sectionCount >= 3) {
    return { kind: "multimodal-fusion" };
  }
  if (hasLoop) {
    return { kind: "feedback-loop" };
  }
  if (nodes.length >= 5) {
    return { kind: "horizontal-pipeline" };
  }
  return { kind: "stacked-flow" };
}

function comesEarlier(fromId, toId, nodes) {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  return (indexById.get(toId) ?? 0) < (indexById.get(fromId) ?? 0);
}

function buildScene(spec) {
  if (spec.layout.kind === "multimodal-fusion") {
    return buildMultimodalScene(spec);
  }
  if (spec.layout.kind === "feedback-loop") {
    return buildFeedbackScene(spec);
  }
  if (spec.layout.kind === "horizontal-pipeline") {
    return buildHorizontalScene(spec);
  }
  return buildStackedScene(spec);
}

function buildHorizontalScene(spec) {
  const width = 1180;
  const height = 720;
  const boxWidth = 184;
  const boxHeight = 96;
  const startX = 86;
  const y = 272;
  const gap = 32;
  const positions = {};

  spec.nodes.forEach((node, index) => {
    positions[node.id] = {
      x: startX + index * (boxWidth + gap),
      y,
      width: boxWidth,
      height: boxHeight
    };
  });

  return {
    width,
    height,
    positions,
    layout: spec.layout,
    sections: buildSceneSections(spec.sections, positions, {
      padX: 22,
      padY: 72,
      titleOffset: 18,
      minHeight: 160
    })
  };
}

function buildFeedbackScene(spec) {
  const width = 1180;
  const height = 760;
  const boxWidth = 196;
  const boxHeight = 96;
  const centerY = 290;
  const positions = {};

  spec.nodes.forEach((node, index) => {
    positions[node.id] = {
      x: 78 + index * 206,
      y: centerY,
      width: boxWidth,
      height: boxHeight
    };
  });

  return {
    width,
    height,
    positions,
    layout: spec.layout,
    sections: buildSceneSections(spec.sections, positions, {
      padX: 26,
      padY: 86,
      titleOffset: 18,
      minHeight: 180
    })
  };
}

function buildStackedScene(spec) {
  const width = 980;
  const height = 860;
  const boxWidth = 280;
  const boxHeight = 86;
  const startY = 154;
  const gapY = 38;
  const x = 350;
  const positions = {};

  spec.nodes.forEach((node, index) => {
    positions[node.id] = {
      x,
      y: startY + index * (boxHeight + gapY),
      width: boxWidth,
      height: boxHeight
    };
  });

  return {
    width,
    height,
    positions,
    layout: spec.layout,
    sections: buildSceneSections(spec.sections, positions, {
      padX: 20,
      padY: 28,
      titleOffset: 18,
      minHeight: 122
    })
  };
}

function buildMultimodalScene(spec) {
  const width = 1240;
  const height = 780;
  const boxWidth = 200;
  const boxHeight = 96;
  const positions = {};
  const inputs = spec.nodes.filter((node) => node.type === "input");
  const middle = spec.nodes.filter((node) => node.type === "process");
  const outputs = spec.nodes.filter((node) => node.type !== "input" && node.type !== "process");

  inputs.forEach((node, index) => {
    positions[node.id] = {
      x: 88,
      y: 180 + index * 150,
      width: boxWidth,
      height: boxHeight
    };
  });

  middle.forEach((node, index) => {
    positions[node.id] = {
      x: index < middle.length - 1 ? 450 + index * 232 : 850,
      y: index < middle.length - 1 ? 180 + index * 150 : 255,
      width: boxWidth,
      height: boxHeight
    };
  });

  outputs.forEach((node, index) => {
    positions[node.id] = {
      x: 850,
      y: 420 + index * 130,
      width: boxWidth,
      height: boxHeight
    };
  });

  spec.nodes.forEach((node, index) => {
    if (!positions[node.id]) {
      positions[node.id] = {
        x: 450 + (index % 2) * 240,
        y: 180 + Math.floor(index / 2) * 150,
        width: boxWidth,
        height: boxHeight
      };
    }
  });

  return {
    width,
    height,
    positions,
    layout: spec.layout,
    sections: buildSceneSections(spec.sections, positions, {
      padX: 24,
      padY: 74,
      titleOffset: 18,
      minHeight: 168
    })
  };
}

function buildSceneSections(sections, positions, options) {
  return sections.map((section, index) => {
    const bounds = section.nodeIds
      .map((nodeId) => positions[nodeId])
      .filter(Boolean)
      .reduce((acc, node) => ({
        minX: Math.min(acc.minX, node.x),
        minY: Math.min(acc.minY, node.y),
        maxX: Math.max(acc.maxX, node.x + node.width),
        maxY: Math.max(acc.maxY, node.y + node.height)
      }), {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      });

    return {
      ...section,
      x: bounds.minX - options.padX,
      y: bounds.minY - options.padY,
      width: Math.max(200, bounds.maxX - bounds.minX + options.padX * 2),
      height: Math.max(options.minHeight, bounds.maxY - bounds.minY + options.padY + 22),
      titleOffset: options.titleOffset,
      variant: index % 4
    };
  });
}

function buildNode(node, position) {
  const fillByType = {
    input: "#fff1d1",
    process: "#fff3e8",
    decision: "#ebf4ff",
    output: "#eaf8f0"
  };

  const strokeByType = {
    input: "#d69f32",
    process: "#d6663f",
    decision: "#4f8ac8",
    output: "#47a36d"
  };

  const fill = fillByType[node.type] || fillByType.process;
  const stroke = strokeByType[node.type] || strokeByType.process;
  const icon = iconForType(node.type);
  const lines = wrapText(node.label, 22);

  const textSvg = lines
    .map((line, index) => {
      const dy = position.y + 48 + index * 18;
      return `<text x="${position.x + position.width / 2}" y="${dy}" text-anchor="middle" font-size="15" font-weight="600" fill="#17313e">${escapeXml(line)}</text>`;
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
      <circle cx="${position.x + 28}" cy="${position.y + 28}" r="15" fill="white" stroke="${stroke}" stroke-width="1.5"></circle>
      <text x="${position.x + 28}" y="${position.y + 33}" text-anchor="middle" font-size="15" font-weight="700" fill="${stroke}">${icon}</text>
    </g>
    ${textSvg}
  `;
}

function buildSection(section) {
  const fills = ["#fff5e8", "#eef6ff", "#eef9f1", "#fff8e9"];
  const strokes = ["#e8c48d", "#bfd7ef", "#c9e4d3", "#ead8a1"];
  const fill = fills[section.variant % fills.length];
  const stroke = strokes[section.variant % strokes.length];

  return `
    <g>
      <rect
        x="${section.x}"
        y="${section.y}"
        width="${section.width}"
        height="${section.height}"
        rx="26"
        fill="${fill}"
        stroke="${stroke}"
        stroke-width="1.5"
      ></rect>
      <text x="${section.x + 20}" y="${section.y + section.titleOffset}" font-size="14" font-weight="700" fill="#17313e">${escapeXml(section.label)}</text>
    </g>
  `;
}

function buildEdge(edge, positions, layoutKind) {
  const from = positions[edge.from];
  const to = positions[edge.to];
  if (!from || !to) {
    return "";
  }

  const dashed = edge.style === "dashed";
  const centers = {
    fromX: from.x + from.width / 2,
    fromY: from.y + from.height / 2,
    toX: to.x + to.width / 2,
    toY: to.y + to.height / 2
  };

  const isBackward = centers.toX < centers.fromX || centers.toY < centers.fromY;
  const horizontalBias = Math.abs(centers.toX - centers.fromX) > Math.abs(centers.toY - centers.fromY);

  let x1 = horizontalBias ? from.x + from.width : centers.fromX;
  let y1 = horizontalBias ? centers.fromY : from.y + from.height;
  let x2 = horizontalBias ? to.x : centers.toX;
  let y2 = horizontalBias ? centers.toY : to.y;
  let path = `M ${x1} ${y1} L ${x2} ${y2}`;
  let labelX = (x1 + x2) / 2;
  let labelY = (y1 + y2) / 2 - 10;

  if (isBackward || layoutKind === "feedback-loop" && edge.style === "dashed") {
    const dx = Math.max(70, Math.abs(x2 - x1) * 0.5);
    const curveDirection = x2 >= x1 ? 1 : -1;
    path = [
      `M ${centers.fromX} ${from.y}`,
      `C ${centers.fromX + dx} ${from.y - 70}, ${centers.toX + dx * curveDirection} ${to.y + to.height + 70}, ${centers.toX} ${to.y + to.height}`
    ].join(" ");
    labelX = centers.fromX + dx * 0.65;
    labelY = (from.y + to.y + to.height) / 2 - 10;
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

function buildCaptionText(caption, width, height) {
  const lines = wrapText(caption, 92);
  return lines
    .map((line, index) => `<text x="48" y="${height - 52 + index * 18}" font-size="13" fill="#5d6f75">${escapeXml(line)}</text>`)
    .join("");
}

function buildCaption(title, sections, notes) {
  const sectionLabels = sections.slice(0, 3).map((section) => section.label.toLowerCase());
  const sectionPhrase = sectionLabels.length ? sectionLabels.join(", ") : "core pipeline stages";
  const notePhrase = notes.length ? ` Key note: ${notes[0]}.` : "";
  return `${title} visualizes the research workflow across ${sectionPhrase}.${notePhrase}`;
}

function formatLayoutLabel(kind) {
  const labels = {
    "multimodal-fusion": "Multimodal Figure",
    "feedback-loop": "Feedback Figure",
    "horizontal-pipeline": "Pipeline Figure",
    "stacked-flow": "Compact Figure"
  };
  return labels[kind] || "Research Figure";
}

function iconForType(type) {
  const map = {
    input: "I",
    process: "P",
    decision: "D",
    output: "O"
  };
  return map[type] || "P";
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

async function downloadSvgAsPng(svg, filename) {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });

  const viewBox = svg.viewBox.baseVal;
  const canvas = document.createElement("canvas");
  canvas.width = viewBox.width || 1200;
  canvas.height = viewBox.height || 800;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffdf9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  URL.revokeObjectURL(url);

  const pngUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = pngUrl;
  link.download = filename;
  link.click();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
