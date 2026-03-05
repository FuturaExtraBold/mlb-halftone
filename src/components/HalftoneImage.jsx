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

export function HalftoneImage() {
  const { hoveredTeam, config } = useApp();
  const canvasRef = useRef(null);
  const dotRadiiRef = useRef([]);
  const gridDimensionsRef = useRef({ cols: 0, rows: 0 });
  const tweenRef = useRef(null);
  const imageAspectRef = useRef(null);
  const configRef = useRef(config);

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

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    const animateToRadii = (targetRadii, totalDots) => {
      if (!isCurrent) return;

      const proxy = { progress: 0 };
      const startRadii = [...dotRadiiRef.current];

      tweenRef.current = gsap.to(proxy, {
        progress: 1,
        duration: animationDuration,
        ease: animationEase,
        onUpdate: () => {
          const p = proxy.progress;
          for (let i = 0; i < totalDots; i++) {
            dotRadiiRef.current[i] =
              startRadii[i] + (targetRadii[i] - startRadii[i]) * p;
          }
          drawDots();
        },
      });
    };

    const { cols, rows } = gridDimensionsRef.current;
    const totalDots = cols * rows;

    if (!hoveredTeam?.playerImage) {
      if (totalDots > 0) {
        animateToRadii(new Array(totalDots).fill(0), totalDots);
      }
      return () => {
        isCurrent = false;
      };
    }

    const imageSrc = hoveredTeam.playerImage;
    const cacheKey = `${imageSrc}:${gridSize}`;

    if (totalDots > 0 && imageCache.has(cacheKey)) {
      const brightnessGrid = imageCache.get(cacheKey);
      const targetRadii = brightnessGrid.map(brightnessToRadius);
      animateToRadii(targetRadii, totalDots);
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
      const curTotalDots = curCols * curRows;

      const brightnessGrid = sampleImageBrightness(
        img,
        curCols,
        curRows,
        gridSize,
      );
      imageCache.set(cacheKey, brightnessGrid);
      const targetRadii = brightnessGrid.map(brightnessToRadius);
      animateToRadii(targetRadii, curTotalDots);
    };
    img.src = imageSrc;

    return () => {
      isCurrent = false;
    };
  }, [hoveredTeam, config]);

  return <canvas ref={canvasRef} className="halftone-canvas" />;
}
