import gsap from "gsap";
import { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";

// Cache brightness data keyed by "imageSrc:gridSize"
const imageCache = new Map();

function sampleImageBrightness(img, cols, rows, gridSize) {
  const canvas = document.createElement("canvas");
  canvas.width = cols * gridSize;
  canvas.height = rows * gridSize;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const brightnessGrid = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let totalBrightness = 0;
      let pixelCount = 0;

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const px = col * gridSize + x;
          const py = row * gridSize + y;
          const idx = (py * canvas.width + px) * 4;

          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          if (a < 128) continue;

          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          totalBrightness += brightness;
          pixelCount++;
        }
      }

      brightnessGrid.push(pixelCount > 0 ? totalBrightness / pixelCount : 0);
    }
  }

  return brightnessGrid;
}

function getCoverDimensions(imgWidth, imgHeight, vpWidth, vpHeight) {
  const imgAspect = imgWidth / imgHeight;
  const vpAspect = vpWidth / vpHeight;

  let width, height;
  if (vpAspect > imgAspect) {
    width = vpWidth;
    height = vpWidth / imgAspect;
  } else {
    height = vpHeight;
    width = vpHeight * imgAspect;
  }

  return { width, height };
}

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function drawShape(ctx, cx, cy, r, shape) {
  if (r <= 0) return;

  switch (shape) {
    case "square":
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;

    case "diamond":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      break;

    case "cross": {
      const t = r / 3;
      ctx.fillRect(cx - t, cy - r, t * 2, r * 2);
      ctx.fillRect(cx - r, cy - t, r * 2, t * 2);
      break;
    }

    case "x": {
      const t = r / 3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-t, -r, t * 2, r * 2);
      ctx.fillRect(-r, -t, r * 2, t * 2);
      ctx.restore();
      break;
    }

    case "triangle":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
      ctx.closePath();
      ctx.fill();
      break;

    case "star": {
      const outerR = r;
      const innerR = r * 0.4;
      const points = 5;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const rad = i % 2 === 0 ? outerR : innerR;
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "circle":
    default:
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function computeStaggerOffsets(cols, rows, staggerType) {
  const total = cols * rows;
  const offsets = new Float32Array(total);

  if (staggerType === "none") {
    return offsets; // all zeros
  }

  const centerCol = (cols - 1) / 2;
  const centerRow = (rows - 1) / 2;
  const maxDist = Math.sqrt(centerCol * centerCol + centerRow * centerRow) || 1;

  let min = Infinity;
  let max = -Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      let val;

      switch (staggerType) {
        case "left-right":
          val = col / Math.max(1, cols - 1);
          break;
        case "top-bottom":
          val = row / Math.max(1, rows - 1);
          break;
        case "center-out": {
          const dc = col - centerCol;
          const dr = row - centerRow;
          val = Math.sqrt(dc * dc + dr * dr) / maxDist;
          break;
        }
        case "random":
          val = Math.random();
          break;
        case "wave":
          val = (col / Math.max(1, cols - 1) + row / Math.max(1, rows - 1)) / 2;
          break;
        default:
          val = 0;
      }

      offsets[i] = val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  // Normalize to [0, 1]
  const range = max - min || 1;
  for (let i = 0; i < total; i++) {
    offsets[i] = (offsets[i] - min) / range;
  }

  return offsets;
}

export function HalftoneImage() {
  const { hoveredTeam, config } = useApp();
  const canvasRef = useRef(null);
  const dotRadiiRef = useRef([]);
  const gridDimensionsRef = useRef({ cols: 0, rows: 0 });
  const tweenRef = useRef(null);
  const imageAspectRef = useRef(null);
  const configRef = useRef(config);
  const staggerOffsetsRef = useRef(new Float32Array(0));

  // Keep configRef in sync with latest config every render
  configRef.current = config;

  const updateCanvasSize = () => {
    if (!imageAspectRef.current || !canvasRef.current) return;

    const { gridSize } = configRef.current;
    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;
    const { width: imgWidth, height: imgHeight } = imageAspectRef.current;

    const { width, height } = getCoverDimensions(
      imgWidth,
      imgHeight,
      vpWidth,
      vpHeight,
    );

    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);

    const prevTotal =
      gridDimensionsRef.current.cols * gridDimensionsRef.current.rows;
    const newTotal = cols * rows;

    gridDimensionsRef.current = { cols, rows };

    if (newTotal !== prevTotal) {
      const oldRadii = dotRadiiRef.current;
      dotRadiiRef.current = new Array(newTotal).fill(0);
      for (let i = 0; i < Math.min(oldRadii.length, newTotal); i++) {
        dotRadiiRef.current[i] = oldRadii[i];
      }
      // Recompute stagger offsets for new grid dimensions
      staggerOffsetsRef.current = computeStaggerOffsets(
        cols,
        rows,
        configRef.current.staggerType,
      );
    }

    canvasRef.current.width = cols * gridSize;
    canvasRef.current.height = rows * gridSize;
  };

  // Use a ref so the resize handler always calls the latest updateCanvasSize
  const updateCanvasSizeRef = useRef(updateCanvasSize);
  updateCanvasSizeRef.current = updateCanvasSize;

  useEffect(() => {
    const handleResize = () => updateCanvasSizeRef.current();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (tweenRef.current) tweenRef.current.kill();

    let isCurrent = true;

    // Resize canvas to reflect any gridSize change
    updateCanvasSize();

    const {
      gridSize,
      maxDotSize,
      minDotSize,
      brightnessMin,
      brightnessMax,
      dotColorHex,
      dotOpacity,
      animationDuration,
      animationEase,
      invertMode,
      dotShape,
      transitionMode,
      staggerType,
      staggerAmount,
    } = config;

    const resolvedDotColor = hexToRgba(dotColorHex, dotOpacity);

    const brightnessToRadius = (brightness) => {
      const clamped = Math.max(
        brightnessMin,
        Math.min(brightnessMax, brightness),
      );
      let normalized =
        (clamped - brightnessMin) / (brightnessMax - brightnessMin);
      if (invertMode) normalized = 1 - normalized;
      return minDotSize / 2 + (normalized * (maxDotSize - minDotSize)) / 2;
    };

    const drawDots = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      const { cols, rows } = gridDimensionsRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = resolvedDotColor;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          const radius = dotRadiiRef.current[idx];

          if (radius > 0) {
            const cx = col * gridSize + gridSize / 2;
            const cy = row * gridSize + gridSize / 2;
            drawShape(ctx, cx, cy, radius, dotShape);
          }
        }
      }
    };

    // Recompute stagger offsets if staggerType changed or grid is new
    const { cols, rows } = gridDimensionsRef.current;
    const totalDots = cols * rows;

    if (staggerOffsetsRef.current.length !== totalDots) {
      staggerOffsetsRef.current = computeStaggerOffsets(
        cols,
        rows,
        staggerType,
      );
    }

    const getStaggerOffsets = () => {
      // Recompute if stagger type may have changed
      return computeStaggerOffsets(cols, rows, staggerType);
    };

    const animateToRadii = (targetRadii, totalDots, duration, onComplete) => {
      if (!isCurrent) return;

      const proxy = { t: 0 };
      const startRadii = [...dotRadiiRef.current];
      const staggerOffsets = getStaggerOffsets();
      const staggerWindow = Math.max(0, Math.min(0.95, staggerAmount));
      const dotDuration = Math.max(0.001, 1 - staggerWindow);

      tweenRef.current = gsap.to(proxy, {
        t: 1,
        duration,
        ease: animationEase,
        onUpdate: () => {
          const t = proxy.t;
          for (let i = 0; i < totalDots; i++) {
            const dotStart = staggerOffsets[i] * staggerWindow;
            const dotP = Math.max(0, Math.min(1, (t - dotStart) / dotDuration));
            dotRadiiRef.current[i] =
              startRadii[i] + (targetRadii[i] - startRadii[i]) * dotP;
          }
          drawDots();
        },
        onComplete: () => {
          if (onComplete) onComplete();
        },
      });
    };

    const runMorphTransition = (targetRadii) => {
      animateToRadii(targetRadii, totalDots, animationDuration);
    };

    const runExitEnterTransition = (targetRadii) => {
      const zeros = new Array(totalDots).fill(0);

      // Exit phase at half duration so enter begins quickly
      animateToRadii(zeros, totalDots, animationDuration * 0.5, () => {
        if (!isCurrent) return;
        animateToRadii(targetRadii, totalDots, animationDuration);
      });
    };

    if (!hoveredTeam?.playerImage) {
      if (totalDots > 0) {
        if (transitionMode === "exit-enter") {
          runExitEnterTransition(new Array(totalDots).fill(0));
        } else {
          runMorphTransition(new Array(totalDots).fill(0));
        }
      }
      return () => {
        isCurrent = false;
      };
    }

    const imageSrc = hoveredTeam.playerImage;
    const cacheKey = `${imageSrc}:${gridSize}`;

    const applyTargetRadii = (brightnessGrid) => {
      const targetRadii = brightnessGrid.map(brightnessToRadius);
      if (transitionMode === "exit-enter") {
        runExitEnterTransition(targetRadii);
      } else {
        runMorphTransition(targetRadii);
      }
    };

    if (totalDots > 0 && imageCache.has(cacheKey)) {
      applyTargetRadii(imageCache.get(cacheKey));
      return () => {
        isCurrent = false;
      };
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!isCurrent) return;

      if (!imageAspectRef.current) {
        imageAspectRef.current = {
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
        updateCanvasSize();
      }

      const { cols: curCols, rows: curRows } = gridDimensionsRef.current;

      const brightnessGrid = sampleImageBrightness(
        img,
        curCols,
        curRows,
        gridSize,
      );
      imageCache.set(cacheKey, brightnessGrid);
      applyTargetRadii(brightnessGrid);
    };
    img.src = imageSrc;

    return () => {
      isCurrent = false;
    };
  }, [hoveredTeam, config]);

  return <canvas ref={canvasRef} className="halftone-canvas" />;
}
