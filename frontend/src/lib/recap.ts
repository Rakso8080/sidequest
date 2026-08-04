import type { RecapItem } from "../types";
import { assetUrl } from "./format";

const W = 1280;
const H = 720;
const PER_PHOTO_MS = 2600;
const FPS = 30;

async function loadImage(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to load image: ${url}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSlide(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  item: RecapItem,
  localMs: number,
  idx: number,
  total: number,
  squadName: string,
) {
  // Base
  ctx.fillStyle = "#120d1f";
  ctx.fillRect(0, 0, W, H);

  // Cover-fit photo with a subtle zoom-in effect
  const zoom = 1 + 0.06 * Math.min(1, localMs / PER_PHOTO_MS);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  coverDraw(ctx, img, W, H);
  ctx.restore();

  // Gradient for legibility
  const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
  grad.addColorStop(0, "rgba(10,6,20,0)");
  grad.addColorStop(1, "rgba(10,6,20,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top brand bar
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 26px Nunito, system-ui, sans-serif";
  ctx.fillText("SIDEQUEST", 56, 66);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 22px Nunito, system-ui, sans-serif";
  ctx.fillText(`· ${squadName.toUpperCase()}`, 240, 66);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px Nunito, system-ui, sans-serif";
  ctx.fillText(item.title.slice(0, 42), 56, H - 150);

  // Category chip
  ctx.fillStyle = "rgba(139,92,246,0.9)";
  roundRect(ctx, 58, H - 128, 220, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 24px Nunito, system-ui, sans-serif";
  ctx.fillText(item.category.toUpperCase(), 86, H - 93);

  // Points chip
  ctx.fillStyle = "rgba(217,70,239,0.9)";
  const pts = `+${item.points} PTS`;
  ctx.font = "800 24px Nunito, system-ui, sans-serif";
  const pw = ctx.measureText(pts).width;
  roundRect(ctx, 294, H - 128, pw + 48, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(pts, 318, H - 93);

  // Date + member
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 24px Nunito, system-ui, sans-serif";
  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";
  ctx.fillText(`${item.user_avatar} ${item.user_name} · ${date}`, 56, H - 48);

  // Progress dots
  const dots = Math.min(total, 10);
  for (let i = 0; i < dots; i++) {
    const active = idx === Math.floor((i / Math.max(1, dots - 1)) * (total - 1));
    ctx.beginPath();
    ctx.arc(W - 80, 62, active ? 9 : 6, 0, 2 * Math.PI);
    ctx.fillStyle = active ? "#f0abfc" : "rgba(255,255,255,0.35)";
    ctx.fill();
  }
}

/**
 * Renders a slideshow video of the squad's approved photo memories in the
 * browser (no server-side video processing) using canvas.captureStream +
 * MediaRecorder. Returns a playable/downloadable WebM blob.
 */
export async function generateRecapVideo(
  items: RecapItem[],
  squadName: string,
): Promise<{ blob: Blob; mime: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  const c2d: CanvasRenderingContext2D = ctx;

  const imgs = await Promise.all(
    items.map((it) => loadImage(assetUrl(it.proof_file) ?? "")),
  );

  const stream = canvas.captureStream(FPS);
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  rec.start(250);
  const totalMs = imgs.length * PER_PHOTO_MS;
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    function frame(now: number) {
      const t = Math.min(totalMs, now - t0);
      const idx = Math.min(imgs.length - 1, Math.floor(t / PER_PHOTO_MS));
      drawSlide(c2d, imgs[idx], items[idx], t - idx * PER_PHOTO_MS, idx, imgs.length, squadName);
      if (t < totalMs) {
        requestAnimationFrame(frame);
      } else {
        rec.stop();
        resolve();
      }
    }
    try {
      requestAnimationFrame(frame);
    } catch (err) {
      reject(err);
    }
  });
  const blob = await done;
  imgs.forEach((img) => img.close());
  return { blob, mime };
}
