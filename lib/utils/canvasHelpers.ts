// lib/utils/canvasHelpers.ts

export function preRenderTarget(
  radius: number,
  colorStart: string,
  colorMid: string,
  colorEnd: string,
  dpr = 1
): HTMLCanvasElement | OffscreenCanvas {
  const size = Math.ceil(radius * 2) + 4;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size * dpr, size * dpr)
    : document.createElement("canvas");

  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  const center = size / 2;

  // Radial gradient for sphere look
  const gradient = ctx.createRadialGradient(
    center - radius * 0.3,
    center - radius * 0.3,
    radius * 0.1,
    center,
    center,
    radius
  );
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(0.35, colorMid);
  gradient.addColorStop(1, colorEnd);

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  return canvas;
}

export function drawBackgroundGrid(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  modeId: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear background
  ctx.clearRect(0, 0, width, height);

  // Background color - dark slate
  ctx.fillStyle = "#0c0f17";
  ctx.fillRect(0, 0, width, height);

  // Determine mode theme color
  const themeColors: Record<string, string> = {
    "static-flick": "51, 102, 255", // Blue
    "tracking-mode": "6, 182, 212", // Cyan
    "target-switch": "29, 185, 84", // Green
    "burst-reaction": "249, 115, 22", // Orange
    "micro-adjust": "244, 63, 94", // Rose
    "reaction-test": "234, 179, 8", // Yellow
    "flick-benchmark": "236, 72, 153", // Pink
    "consistency-check": "139, 92, 246", // Purple
    "echolocation": "6, 182, 212", // Sonar Cyan
    "cognitive-overdrive": "59, 130, 246", // Blue
    "recoil-evasion": "248, 113, 113", // Red
  };
  const rgb = themeColors[modeId] || "100, 116, 139"; // Slate default

  // Draw grid lines
  ctx.strokeStyle = `rgba(${rgb}, 0.04)`;
  ctx.lineWidth = 1;
  const gridSize = 64;

  ctx.beginPath();
  for (let x = 0; x < width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Radial vignette overlay to fade edges
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7
  );
  grad.addColorStop(0, "rgba(12, 15, 23, 0)");
  grad.addColorStop(0.5, `rgba(${rgb}, 0.02)`);
  grad.addColorStop(1, "rgba(5, 5, 5, 0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

export function drawCrosshair(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  mouseX: number,
  mouseY: number,
  feedback: "hit" | "miss" | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(mouseX, mouseY);

  let color = "rgba(0, 255, 255, 0.85)"; // Default cyan
  if (feedback === "hit") color = "rgba(16, 185, 129, 1)"; // Emerald green
  if (feedback === "miss") color = "rgba(239, 68, 68, 1)"; // Red

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  const gap = 4;
  const len = 6;
  ctx.beginPath();
  // Top
  ctx.moveTo(0, -gap);
  ctx.lineTo(0, -gap - len);
  // Bottom
  ctx.moveTo(0, gap);
  ctx.lineTo(0, gap + len);
  // Left
  ctx.moveTo(-gap, 0);
  ctx.lineTo(-gap - len, 0);
  // Right
  ctx.moveTo(gap, 0);
  ctx.lineTo(gap + len, 0);
  ctx.stroke();

  // Dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Expand feedback ring
  if (feedback) {
    ctx.strokeStyle = feedback === "hit" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function preRenderStaticFlickTarget(radius: number, dpr = 1): HTMLCanvasElement | OffscreenCanvas {
  const glowRadius = radius * 1.7;
  const size = Math.ceil(glowRadius * 2) + 8;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size * dpr, size * dpr)
    : document.createElement("canvas");

  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  const center = size / 2;

  // Outer ambient glow
  const glow = ctx.createRadialGradient(center, center, radius * 0.5, center, center, glowRadius);
  glow.addColorStop(0, "rgba(239, 68, 68, 0.35)");
  glow.addColorStop(1, "rgba(239, 68, 68, 0)");
  ctx.beginPath();
  ctx.arc(center, center, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Inner ring outline
  ctx.beginPath();
  ctx.arc(center, center, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Core sphere gradient
  const gradient = ctx.createRadialGradient(
    center - radius * 0.3, center - radius * 0.3, radius * 0.1,
    center, center, radius
  );
  gradient.addColorStop(0, "#FFCCCC");
  gradient.addColorStop(0.35, "#EF4444");
  gradient.addColorStop(1, "#550000");
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(239, 68, 68, 0.7)";
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Specular highlight (top-left gleam)
  const spec = ctx.createRadialGradient(
    center - radius * 0.35, center - radius * 0.35, 0,
    center - radius * 0.35, center - radius * 0.35, radius * 0.5
  );
  spec.addColorStop(0, "rgba(255,255,255,0.5)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = spec;
  ctx.fill();

  return canvas;
}

export function preRenderBurstReactionTarget(radius: number, dpr = 1): HTMLCanvasElement | OffscreenCanvas {
  const shadowOffset = 20;
  const shadowBlur = 25;
  const size = Math.ceil((radius + shadowBlur) * 2) + shadowOffset;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size * dpr, size * dpr)
    : document.createElement("canvas");

  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  const center = radius + shadowBlur;

  const gradient = ctx.createRadialGradient(
    center - radius * 0.3, center - radius * 0.3, radius * 0.1,
    center, center, radius
  );
  gradient.addColorStop(0, "#CBD5E1");
  gradient.addColorStop(0.3, "#F97316");
  gradient.addColorStop(1, "#7C2D12");

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowOffset;
  ctx.fill();

  return canvas;
}

export function preRenderTrackingTarget(radius: number, isHit: boolean, dpr = 1): HTMLCanvasElement | OffscreenCanvas {
  const glowRadius = radius * 1.6;
  const size = Math.ceil(glowRadius * 2) + 8;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size * dpr, size * dpr)
    : document.createElement("canvas");

  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  const center = size / 2;

  // Outer glow ring
  const glow = ctx.createRadialGradient(center, center, radius * 0.5, center, center, glowRadius);
  if (isHit) {
    glow.addColorStop(0, "rgba(0, 229, 255, 0.35)");
    glow.addColorStop(1, "rgba(0, 229, 255, 0)");
  } else {
    glow.addColorStop(0, "rgba(239, 68, 68, 0.30)");
    glow.addColorStop(1, "rgba(239, 68, 68, 0)");
  }
  ctx.beginPath();
  ctx.arc(center, center, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Core sphere gradient
  const gradient = ctx.createRadialGradient(
    center - radius * 0.3, center - radius * 0.3, radius * 0.1,
    center, center, radius
  );
  if (isHit) {
    gradient.addColorStop(0, "#CBD5E1");
    gradient.addColorStop(0.3, "#00E5FF");
    gradient.addColorStop(1, "#004455");
  } else {
    gradient.addColorStop(0, "#FFCCCC");
    gradient.addColorStop(0.3, "#EF4444");
    gradient.addColorStop(1, "#550000");
  }
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.shadowColor = isHit ? "rgba(0, 229, 255, 0.8)" : "rgba(239, 68, 68, 0.6)";
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  return canvas;
}

export function preRenderCognitiveTarget(radius: number, dpr = 1): HTMLCanvasElement | OffscreenCanvas {
  const shadowBlur = 15;
  const size = Math.ceil((radius + shadowBlur) * 2);
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size * dpr, size * dpr)
    : document.createElement("canvas");

  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  const center = radius + shadowBlur;

  const gradient = ctx.createRadialGradient(
    center - radius * 0.3, center - radius * 0.3, radius * 0.1,
    center, center, radius
  );
  gradient.addColorStop(0, "#FFAAAA");
  gradient.addColorStop(0.3, "#EF4444");
  gradient.addColorStop(1, "#660000");

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(220,38,38,0.6)";
  ctx.shadowBlur = shadowBlur;
  ctx.fill();

  return canvas;
}

export function preRenderCognitiveDistractor(radius: number, dpr = 1): HTMLCanvasElement | OffscreenCanvas {
  const size = Math.ceil(radius * 2) + 4;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size * dpr, size * dpr)
    : document.createElement("canvas");

  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  const center = size / 2;

  const grad = ctx.createRadialGradient(
    center - radius * 0.3, center - radius * 0.3, radius * 0.1,
    center, center, radius
  );
  grad.addColorStop(0, "#66b2ff");
  grad.addColorStop(1, "#004c99");

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(center - radius * 0.4, center - radius * 0.4);
  ctx.lineTo(center + radius * 0.4, center + radius * 0.4);
  ctx.moveTo(center + radius * 0.4, center - radius * 0.4);
  ctx.lineTo(center - radius * 0.4, center + radius * 0.4);
  ctx.stroke();

  return canvas;
}
