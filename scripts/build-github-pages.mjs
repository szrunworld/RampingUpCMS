import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CMS_ORIGIN = process.env.CMS_ORIGIN || "http://127.0.0.1:4310";
const OUT_DIR = path.resolve(process.cwd(), process.env.OUT_DIR || "docs");
const OWNER = process.env.GITHUB_OWNER || "szrunworld";
const REPO = process.env.GITHUB_REPO || "RampingUpCMS";
const SITE_TITLE = process.env.SITE_TITLE || "RampingUp CMS";
const SITE_DESCRIPTION =
  process.env.SITE_DESCRIPTION ||
  "A Feishu Docs powered blog, exported as a static site for GitHub Pages.";
const SITE_ORIGIN =
  process.env.SITE_ORIGIN || `https://${OWNER}.github.io/${REPO}`;
const INLINE_FEISHU_MEDIA = process.env.INLINE_FEISHU_MEDIA !== "0";

const MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/json": ".json",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
};

const TYPE_LABELS = {
  "0": "Developer",
  "1": "Employer",
};

const TYPE_DESCRIPTIONS = {
  "0": "Engineering roles, resumes, and technical hiring content.",
  "1": "Employer-focused posts, hiring context, and business updates.",
};

const siteCss = String.raw`
:root {
  --bg: #f3efe8;
  --bg-soft: #fbf8f2;
  --paper: rgba(255, 252, 247, 0.9);
  --paper-strong: #fffaf3;
  --line: rgba(108, 79, 46, 0.14);
  --line-strong: rgba(108, 79, 46, 0.28);
  --text: #1f1b17;
  --muted: #706252;
  --brand: #0d7c66;
  --brand-deep: #085645;
  --accent: #c96f2d;
  --shadow: 0 24px 60px rgba(77, 54, 31, 0.12);
  --radius-xl: 28px;
  --radius-lg: 22px;
  --radius-md: 16px;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(13, 124, 102, 0.13), transparent 28%),
    radial-gradient(circle at 85% 10%, rgba(201, 111, 45, 0.16), transparent 24%),
    linear-gradient(180deg, #f5f0e8 0%, #f3efe8 45%, #f7f3ec 100%);
  font-family: "Avenir Next", "IBM Plex Sans", "PingFang SC", "Hiragino Sans GB",
    "Noto Sans SC", sans-serif;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

a {
  color: var(--brand);
  text-decoration: none;
}

a:hover {
  color: var(--brand-deep);
}

img {
  max-width: 100%;
}

.shell {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 68px;
}

.site-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
  gap: 20px;
  margin-bottom: 28px;
}

.hero-card,
.hero-side,
.surface {
  border: 1px solid var(--line);
  background: var(--paper);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.hero-card {
  border-radius: 34px;
  padding: 36px 34px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(13, 124, 102, 0.09);
  color: var(--brand);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
}

.hero-card h1 {
  margin: 18px 0 12px;
  font-size: clamp(38px, 6vw, 74px);
  line-height: 0.96;
  letter-spacing: -0.045em;
}

.hero-card h1 span {
  color: var(--brand);
}

.hero-card p {
  margin: 0;
  max-width: 56ch;
  font-size: 17px;
  color: var(--muted);
}

.hero-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
}

.hero-pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(108, 79, 46, 0.12);
  font-size: 13px;
  color: var(--muted);
}

.hero-side {
  border-radius: 30px;
  padding: 28px 26px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  justify-content: space-between;
}

.hero-side h2,
.section-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.hero-side p,
.section-copy {
  margin: 0;
  color: var(--muted);
}

.hero-side ol {
  margin: 0;
  padding-left: 20px;
  color: var(--text);
}

.hero-side li + li {
  margin-top: 10px;
}

.section-block {
  margin-bottom: 26px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
  margin-bottom: 14px;
}

.section-note {
  color: var(--muted);
  font-size: 14px;
}

.section-copy strong {
  color: var(--text);
}

.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.post-card {
  display: grid;
  grid-template-columns: 136px 1fr;
  gap: 16px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  padding: 14px;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.post-card:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  box-shadow: 0 24px 50px rgba(77, 54, 31, 0.16);
}

.post-card__cover {
  display: block;
  width: 136px;
  height: 136px;
  object-fit: cover;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(13, 124, 102, 0.15), rgba(201, 111, 45, 0.22));
}

.post-card__body {
  min-width: 0;
}

.post-card__eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.post-card__tag {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(13, 124, 102, 0.08);
  color: var(--brand);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}

.post-card__date {
  color: var(--muted);
  font-size: 12px;
}

.post-card h3 {
  margin: 0 0 8px;
  font-size: 23px;
  line-height: 1.16;
  letter-spacing: -0.03em;
}

.post-card p {
  margin: 0 0 12px;
  color: var(--muted);
}

.post-card__meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 13px;
}

.post-card__author {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.post-card__author img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(13, 124, 102, 0.12);
}

.post-card__cta {
  color: var(--brand);
  font-weight: 700;
}

.empty-state {
  padding: 28px 24px;
  border-radius: var(--radius-xl);
  text-align: center;
}

.site-footer {
  margin-top: 36px;
  padding: 22px 24px;
  border-radius: var(--radius-xl);
  color: var(--muted);
  font-size: 14px;
}

.site-footer strong {
  color: var(--text);
}

.article-shell {
  width: min(1040px, calc(100vw - 28px));
}

.article-hero {
  border-radius: 36px;
  padding: 18px;
  overflow: hidden;
}

.article-cover {
  border-radius: 26px;
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  background:
    linear-gradient(135deg, rgba(13, 124, 102, 0.15), rgba(201, 111, 45, 0.22));
}

.article-header {
  padding: 28px 16px 10px;
}

.article-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--muted);
}

.article-kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 18px;
}

.article-title {
  margin: 16px 0 12px;
  font-size: clamp(36px, 5.5vw, 68px);
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.article-subtitle {
  margin: 0;
  font-size: 18px;
  color: var(--muted);
}

.article-meta {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 24px;
}

.author-stack {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.author-stack img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(13, 124, 102, 0.12);
}

.author-stack__text {
  min-width: 0;
}

.author-stack__text strong,
.author-stack__text span {
  display: block;
}

.author-stack__text span {
  color: var(--muted);
  font-size: 13px;
}

.article-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.66);
  color: var(--text);
  font-weight: 600;
}

.action-link--primary {
  background: var(--brand);
  border-color: var(--brand);
  color: white;
}

.action-link--soft {
  background: rgba(13, 124, 102, 0.08);
  border-color: rgba(13, 124, 102, 0.18);
  color: var(--brand);
}

.article-body {
  padding: 30px 16px 6px;
}

.content {
  font-size: 17px;
  color: var(--text);
  word-break: break-word;
}

.content > *:first-child {
  margin-top: 0;
}

.content p,
.content li {
  margin: 0 0 1.1em;
}

.content h1,
.content h2,
.content h3,
.content h4 {
  margin: 1.7em 0 0.65em;
  color: var(--text);
  line-height: 1.12;
  letter-spacing: -0.03em;
}

.content h1 {
  font-size: clamp(30px, 4.2vw, 46px);
}

.content h2 {
  font-size: clamp(24px, 3vw, 34px);
}

.content h3 {
  font-size: clamp(20px, 2.4vw, 26px);
}

.content h4 {
  font-size: 18px;
}

.content ul,
.content ol {
  margin: 0 0 1.25em;
  padding-left: 1.35em;
}

.content blockquote {
  margin: 1.4em 0;
  padding: 14px 18px;
  border-left: 4px solid rgba(13, 124, 102, 0.34);
  background: rgba(13, 124, 102, 0.08);
  border-radius: 0 18px 18px 0;
  color: #26443b;
}

.content code {
  padding: 0.15em 0.45em;
  border-radius: 8px;
  background: rgba(31, 27, 23, 0.08);
  font-family: "SFMono-Regular", "JetBrains Mono", "IBM Plex Mono", monospace;
  font-size: 0.92em;
}

.content pre {
  margin: 1.4em 0;
  padding: 18px;
  overflow: auto;
  border-radius: 20px;
  background: #171717;
  color: #f7f4ee;
}

.content pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}

.content a {
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

.content hr {
  margin: 2em 0;
  border: 0;
  border-top: 1px solid rgba(108, 79, 46, 0.18);
}

.content table {
  width: 100%;
  margin: 1.4em 0;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(108, 79, 46, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.content th,
.content td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(108, 79, 46, 0.12);
  text-align: left;
  vertical-align: top;
}

.content th {
  background: rgba(13, 124, 102, 0.09);
}

.content img,
.content .feishu-inline-image {
  display: block;
  width: auto;
  max-width: min(100%, 620px);
  max-height: 440px;
  height: auto;
  margin: 1.5em auto;
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(77, 54, 31, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.content video,
.content .feishu-inline-video {
  display: block;
  width: min(100%, 820px);
  max-height: 460px;
  margin: 1.5em auto;
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(77, 54, 31, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.feishu-file-card {
  margin: 1.6em 0;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid rgba(108, 79, 46, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.feishu-file-card__title {
  font-weight: 700;
  margin-bottom: 8px;
}

.feishu-file-card__meta {
  color: var(--muted);
  font-size: 14px;
  margin-bottom: 10px;
}

.feishu-mention {
  display: inline-flex;
  align-items: center;
  padding: 0.12em 0.55em;
  border-radius: 999px;
  background: rgba(13, 124, 102, 0.08);
  color: var(--brand);
  font-weight: 700;
}

.article-footer {
  margin-top: 28px;
  padding: 18px 0 10px;
  border-top: 1px solid rgba(108, 79, 46, 0.14);
  color: var(--muted);
  font-size: 14px;
}

@media (max-width: 960px) {
  .site-hero,
  .cards,
  .post-card {
    grid-template-columns: 1fr;
  }

  .post-card__cover {
    width: 100%;
    height: 220px;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100vw - 20px, 100%);
    padding-top: 18px;
  }

  .hero-card,
  .hero-side,
  .article-hero {
    border-radius: 24px;
  }

  .hero-card,
  .hero-side {
    padding: 24px 20px;
  }

  .article-body,
  .article-header {
    padding-left: 8px;
    padding-right: 8px;
  }

  .article-meta {
    align-items: flex-start;
  }
}
`;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function articleSummary(post) {
  const text = post.subTitle || post.seoDescription || stripHtml(post.content || "");
  if (!text) {
    return "This article is published from Feishu Docs and exported as a static page.";
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function typeLabel(type) {
  return TYPE_LABELS[String(type)] || "Article";
}

function typeDescription(type) {
  return TYPE_DESCRIPTIONS[String(type)] || "Published content exported from Feishu Docs.";
}

function cleanSlug(value, fallback = "post") {
  const normalized = String(value || fallback).trim().replace(/[\/\\]+/g, "-");
  return normalized || fallback;
}

function decodeHtmlAttribute(value) {
  let result = String(value || "");
  for (let index = 0; index < 3; index += 1) {
    const next = result
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    if (next === result) {
      return next;
    }
    result = next;
  }
  return result;
}

function isLocalCmsMediaUrl(value) {
  const decoded = decodeHtmlAttribute(value);
  return (
    decoded.startsWith("/cms/media?") ||
    decoded.startsWith(`${CMS_ORIGIN}/cms/media?`)
  );
}

function normalizeSourceUrl(value) {
  const decoded = decodeHtmlAttribute(value);
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }
  if (decoded.startsWith("/")) {
    return new URL(decoded, CMS_ORIGIN).href;
  }
  return decoded;
}

function extensionFromMime(mime) {
  return MIME_EXTENSION_MAP[String(mime || "").toLowerCase()] || "";
}

function extensionFromUrl(value) {
  try {
    const source = new URL(value);
    const ext = path.extname(source.pathname);
    return ext && ext.length <= 10 ? ext : "";
  } catch (_) {
    return "";
  }
}

function filenameFromSourceUrl(value) {
  try {
    const source = new URL(value);
    const filename = source.searchParams.get("filename");
    if (filename) {
      return filename.replace(/[\/\\]+/g, "-");
    }
    const token = source.searchParams.get("token");
    if (token) {
      return token.replace(/[\/\\]+/g, "-");
    }
  } catch (_) {
    return "";
  }
  return "";
}

function mimeFromSourceUrl(value) {
  try {
    const source = new URL(value);
    const mime = source.searchParams.get("mime");
    if (mime) {
      return mime;
    }
    const ext = extensionFromUrl(value).toLowerCase();
    const match = Object.entries(MIME_EXTENSION_MAP).find(
      ([, candidateExt]) => candidateExt === ext,
    );
    return match ? match[0] : "application/octet-stream";
  } catch (_) {
    return "application/octet-stream";
  }
}

async function runCurl(args, options = {}) {
  const result = await execFileAsync("curl", args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  return result.stdout;
}

async function canUseFfmpeg() {
  if (typeof canUseFfmpeg.cached === "boolean") {
    return canUseFfmpeg.cached;
  }

  try {
    await execFileAsync("ffmpeg", ["-version"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    canUseFfmpeg.cached = true;
  } catch (_) {
    canUseFfmpeg.cached = false;
  }

  return canUseFfmpeg.cached;
}

async function fetchJson(url, init = {}) {
  const args = ["-sS", "-L", "-f", url];
  const method = String(init.method || "GET").toUpperCase();

  if (method !== "GET") {
    args.unshift("-X", method);
  }

  const headers = init.headers || {};
  for (const [name, value] of Object.entries(headers)) {
    args.push("-H", `${name}: ${value}`);
  }

  if (init.body != null) {
    args.push("--data", typeof init.body === "string" ? init.body : JSON.stringify(init.body));
  }

  const raw = await runCurl(args);
  return JSON.parse(raw);
}

async function fetchBinary(url) {
  return runCurl(["-sS", "-L", "-f", url], { encoding: "buffer" });
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeTextFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function optimizeImageBuffer(buffer, mime) {
  const normalizedMime = String(mime || "").toLowerCase();
  if (!normalizedMime.startsWith("image/")) {
    return { buffer, mime: normalizedMime || "application/octet-stream" };
  }

  const shouldOptimize = normalizedMime === "image/gif" || buffer.length > 300 * 1024;

  if (!shouldOptimize) {
    return { buffer, mime: normalizedMime };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "feishu-pages-"));
  const inputExt = extensionFromMime(normalizedMime) || ".bin";
  const inputPath = path.join(tempDir, `input${inputExt}`);
  await fs.writeFile(inputPath, buffer);

  try {
    if (normalizedMime === "image/gif" && (await canUseFfmpeg())) {
      const outputPath = path.join(tempDir, "output.mp4");
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          inputPath,
          "-vf",
          "fps=8,scale=900:-2:flags=lanczos",
          "-movflags",
          "+faststart",
          "-pix_fmt",
          "yuv420p",
          outputPath,
        ],
        {
          encoding: "utf8",
          maxBuffer: 1024 * 1024 * 16,
        },
      );
      const optimizedBuffer = await fs.readFile(outputPath);
      if (optimizedBuffer.length > 0 && optimizedBuffer.length < buffer.length) {
        return { buffer: optimizedBuffer, mime: "video/mp4" };
      }
      return { buffer, mime: normalizedMime };
    }

    const outputPath = path.join(tempDir, "output.jpg");
    await execFileAsync(
      "sips",
      [
        "-Z",
        "1200",
        "-s",
        "format",
        "jpeg",
        "--setProperty",
        "formatOptions",
        "70",
        inputPath,
        "--out",
        outputPath,
      ],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 4,
      },
    );
    const optimizedBuffer = await fs.readFile(outputPath);
    if (optimizedBuffer.length > 0 && optimizedBuffer.length < buffer.length) {
      return { buffer: optimizedBuffer, mime: "image/jpeg" };
    }
    return { buffer, mime: normalizedMime };
  } catch (_) {
    return { buffer, mime: normalizedMime };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function relativeUrl(fromFilePath, toFilePath) {
  return path
    .relative(path.dirname(fromFilePath), toFilePath)
    .split(path.sep)
    .join("/");
}

async function localizeMediaUrl(sourceValue, state) {
  const sourceUrl = normalizeSourceUrl(sourceValue);
  if (!sourceUrl) {
    return sourceValue;
  }

  if (state.mediaCache.has(sourceUrl)) {
    return state.mediaCache.get(sourceUrl);
  }

  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 18);
  const filenameHint = filenameFromSourceUrl(sourceUrl);
  let ext = path.extname(filenameHint);

  if (!ext) {
    try {
      const parsed = new URL(sourceUrl);
      ext = extensionFromMime(parsed.searchParams.get("mime")) || extensionFromUrl(sourceUrl);
    } catch (_) {
      ext = extensionFromUrl(sourceUrl);
    }
  }

  const mediaFileName = `${hash}${ext || ""}`;
  const mediaFilePath = path.join(state.mediaDir, mediaFileName);
  await ensureDir(path.dirname(mediaFilePath));

  const mime = mimeFromSourceUrl(sourceUrl);
  let fetchedBuffer = null;

  if (INLINE_FEISHU_MEDIA) {
    fetchedBuffer = await fetchBinary(sourceUrl);
    const optimized = await optimizeImageBuffer(fetchedBuffer, mime);
    if (/^(image|video)\//i.test(optimized.mime)) {
      const dataUri = `data:${optimized.mime};base64,${optimized.buffer.toString("base64")}`;
      state.mediaCache.set(sourceUrl, dataUri);
      return dataUri;
    }
  }

  if (!state.writtenMediaFiles.has(mediaFilePath)) {
    await fs.writeFile(mediaFilePath, fetchedBuffer || (await fetchBinary(sourceUrl)));
    state.writtenMediaFiles.add(mediaFilePath);
  }

  const relativePath = `assets/media/${mediaFileName}`;
  state.mediaCache.set(sourceUrl, relativePath);
  return relativePath;
}

function assetPathForPage(rootRelativePath, pageAssetPrefix) {
  if (!rootRelativePath) {
    return "";
  }
  if (
    rootRelativePath.startsWith("data:") ||
    rootRelativePath.startsWith("http://") ||
    rootRelativePath.startsWith("https://") ||
    rootRelativePath.startsWith("//")
  ) {
    return rootRelativePath;
  }
  return `${pageAssetPrefix}${rootRelativePath}`;
}

async function localizePossibleAssetUrl(sourceValue, state, pageAssetPrefix) {
  const normalized = String(sourceValue || "").trim();
  if (!normalized) {
    return "";
  }

  if (isLocalCmsMediaUrl(normalized)) {
    const rootRelativePath = await localizeMediaUrl(normalized, state);
    return assetPathForPage(rootRelativePath, pageAssetPrefix);
  }

  try {
    const url = new URL(normalized);
    if (/(^|\.)feishu\.cn$/i.test(url.hostname)) {
      const proxied = `${CMS_ORIGIN}/cms/media?url=${encodeURIComponent(normalized)}`;
      const rootRelativePath = await localizeMediaUrl(proxied, state);
      return assetPathForPage(rootRelativePath, pageAssetPrefix);
    }
  } catch (_) {
    return normalized;
  }

  return normalized;
}

async function rewriteContentAssets(html, state, pageAssetPrefix) {
  let result = String(html || "");
  const imageMatches = [...result.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/gi)];

  for (const match of imageMatches) {
    const [fullMatch, srcValue] = match;
    if (!isLocalCmsMediaUrl(srcValue)) {
      continue;
    }

    const localized = assetPathForPage(
      await localizeMediaUrl(srcValue, state),
      pageAssetPrefix,
    );

    if (!localized.startsWith("data:video/")) {
      continue;
    }

    const classMatch = fullMatch.match(/\bclass="([^"]*)"/i);
    const className = classMatch
      ? `${classMatch[1]} feishu-inline-video`.trim()
      : "feishu-inline-video";
    const videoTag = `<video class="${escapeHtml(
      className,
    )}" autoplay loop muted playsinline controls src="${escapeHtml(localized)}"></video>`;
    result = result.replace(fullMatch, videoTag);
  }

  const matches = [...result.matchAll(/\b(src|href)="([^"]+)"/gi)];

  for (const match of matches) {
    const [fullMatch, attrName, attrValue] = match;
    if (!isLocalCmsMediaUrl(attrValue)) {
      continue;
    }

    const localized = assetPathForPage(
      await localizeMediaUrl(attrValue, state),
      pageAssetPrefix,
    );
    result = result.replace(fullMatch, `${attrName}="${escapeHtml(localized)}"`);
  }

  return result;
}

function layout({
  title,
  description,
  canonicalPath = "/",
  stylesheetPath = "./assets/site.css",
  bodyClass = "",
  body,
}) {
  const canonicalUrl = `${SITE_ORIGIN.replace(/\/+$/, "")}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <link rel="stylesheet" href="${escapeHtml(stylesheetPath)}" />
</head>
<body class="${escapeHtml(bodyClass)}">
${body}
</body>
</html>`;
}

function renderCard(post) {
  const href = `./posts/${encodeURIComponent(post.outputDirName)}/`;
  const cover = post.localCoverUrl
    ? `<img class="post-card__cover" src="${escapeHtml(post.localCoverUrl)}" alt="${escapeHtml(post.title)}" loading="lazy" />`
    : `<div class="post-card__cover" aria-hidden="true"></div>`;
  const author = post.authorName
    ? `<span class="post-card__author">${
        post.localAuthorAvatar
          ? `<img src="${escapeHtml(post.localAuthorAvatar)}" alt="${escapeHtml(post.authorName)}" loading="lazy" />`
          : ""
      }<span>${escapeHtml(post.authorName)}</span></span>`
    : "";

  return `<a class="post-card surface" href="${escapeHtml(href)}">
    ${cover}
    <div class="post-card__body">
      <div class="post-card__eyebrow">
        <span class="post-card__tag">${escapeHtml(typeLabel(post.type))}</span>
        <span class="post-card__date">${escapeHtml(formatDate(post.publishedAt || post.updatedAt))}</span>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(articleSummary(post))}</p>
      <div class="post-card__meta">
        ${author}
        <span class="post-card__cta">Read article</span>
      </div>
    </div>
  </a>`;
}

function renderSection(type, posts) {
  if (!posts.length) {
    return "";
  }

  return `<section class="section-block">
    <div class="section-header">
      <div>
        <h2 class="section-title">${escapeHtml(typeLabel(type))}</h2>
        <p class="section-copy">${escapeHtml(typeDescription(type))}</p>
      </div>
      <div class="section-note">${posts.length} article${posts.length > 1 ? "s" : ""}</div>
    </div>
    <div class="cards">
      ${posts.map((post) => renderCard(post)).join("\n")}
    </div>
  </section>`;
}

function renderIndexPage(posts) {
  const developerPosts = posts.filter((post) => String(post.type) === "0");
  const employerPosts = posts.filter((post) => String(post.type) === "1");
  const generatedAt = formatDateTime(new Date().toISOString());

  return layout({
    title: `${SITE_TITLE} | Feishu Docs to GitHub Pages`,
    description: SITE_DESCRIPTION,
    canonicalPath: "/",
    stylesheetPath: "./assets/site.css",
    body: `
      <main class="shell">
        <section class="site-hero">
          <div class="hero-card">
            <span class="hero-badge">Feishu CMS · GitHub Pages</span>
            <h1>Publish your <span>Feishu docs</span> as a public site.</h1>
            <p>${escapeHtml(
              "This site is exported from your Feishu Docs based CMS. Editing stays in Feishu, while GitHub Pages serves a clean public-facing static site."
            )}</p>
            <div class="hero-meta">
              <span class="hero-pill">${posts.length} published article${posts.length === 1 ? "" : "s"}</span>
              <span class="hero-pill">Latest export: ${escapeHtml(generatedAt)}</span>
            </div>
            <div class="hero-meta">
              <a class="action-link action-link--soft" href="./search-index.json">Browse JSON index</a>
            </div>
          </div>
          <aside class="hero-side">
            <div>
              <h2>How this works</h2>
              <p>${escapeHtml(
                "Your local CMS reads Feishu Base and Feishu Docs. This repo then exports the published content to plain HTML, CSS, and media files under docs/."
              )}</p>
            </div>
            <ol>
              <li>Edit or publish in Feishu Docs and Base.</li>
              <li>Run the GitHub Pages export script locally.</li>
              <li>Push the generated docs folder and let Pages deploy it.</li>
            </ol>
          </aside>
        </section>

        ${renderSection("0", developerPosts)}
        ${renderSection("1", employerPosts)}

        <footer class="site-footer surface">
          <strong>${escapeHtml(SITE_TITLE)}</strong> is generated from Feishu Docs and committed as a static site for GitHub Pages.
        </footer>
      </main>
    `,
  });
}

function renderArticlePage(post) {
  const canonicalPath = `/posts/${encodeURIComponent(post.outputDirName)}/`;
  const publicUrl = `${SITE_ORIGIN.replace(/\/+$/, "")}${canonicalPath}`;
  const publishedDate = formatDate(post.publishedAt || post.updatedAt);
  const updatedDate = formatDate(post.updatedAt || post.publishedAt);
  const openInFeishu = post.docUrl
    ? `<a class="action-link" href="${escapeHtml(post.docUrl)}" target="_blank" rel="noopener noreferrer">Open in Feishu</a>`
    : "";
  const cover = post.articleCoverUrl
    ? `<img class="article-cover" src="${escapeHtml(post.articleCoverUrl)}" alt="${escapeHtml(post.title)}" loading="lazy" />`
    : "";

  return layout({
    title: `${post.seoTitle || post.title} | ${SITE_TITLE}`,
    description: articleSummary(post),
    canonicalPath,
    stylesheetPath: "../../assets/site.css",
    bodyClass: "article-page",
    body: `
      <main class="shell article-shell">
        <article class="surface article-hero">
          ${cover}
          <header class="article-header">
            <a class="article-back" href="../../">← Back to all articles</a>
            <div class="article-kicker">
              <span class="post-card__tag">${escapeHtml(typeLabel(post.type))}</span>
              ${publishedDate ? `<span class="hero-pill">Published ${escapeHtml(publishedDate)}</span>` : ""}
              ${updatedDate && updatedDate !== publishedDate ? `<span class="hero-pill">Updated ${escapeHtml(updatedDate)}</span>` : ""}
            </div>
            <h1 class="article-title">${escapeHtml(post.title)}</h1>
            ${
              post.subTitle
                ? `<p class="article-subtitle">${escapeHtml(post.subTitle)}</p>`
                : ""
            }
            <div class="article-meta">
              <div class="author-stack">
                ${
                  post.articleAuthorAvatar
                    ? `<img src="${escapeHtml(post.articleAuthorAvatar)}" alt="${escapeHtml(post.authorName || "Author")}" loading="lazy" />`
                    : ""
                }
                <div class="author-stack__text">
                  <strong>${escapeHtml(post.authorName || "RampingUp CMS")}</strong>
                  <span>${escapeHtml(post.authorName ? "Article author" : "Published from Feishu CMS")}</span>
                </div>
              </div>
              <div class="article-actions">
                <a class="action-link action-link--primary" href="${escapeHtml(publicUrl)}">Public URL</a>
                ${openInFeishu}
              </div>
            </div>
          </header>

          <section class="article-body">
            <div class="content">
              ${post.localizedContent}
            </div>
            <footer class="article-footer">
              Static export generated on ${escapeHtml(formatDateTime(new Date().toISOString()))}.
            </footer>
          </section>
        </article>
      </main>
    `,
  });
}

function render404Page() {
  return layout({
    title: `Page not found | ${SITE_TITLE}`,
    description: "The page you are looking for could not be found.",
    canonicalPath: "/404.html",
    stylesheetPath: "./assets/site.css",
    body: `
      <main class="shell">
        <section class="hero-card surface">
          <span class="hero-badge">404</span>
          <h1>That page is <span>not here</span>.</h1>
          <p>The public blog page you opened does not exist, or the article has not been exported yet.</p>
          <div class="hero-meta">
            <a class="action-link action-link--primary" href="./">Back to the homepage</a>
          </div>
        </section>
      </main>
    `,
  });
}

async function build() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await ensureDir(path.join(OUT_DIR, "assets", "media"));
  await writeTextFile(path.join(OUT_DIR, "assets", "site.css"), siteCss);
  await writeTextFile(path.join(OUT_DIR, ".nojekyll"), "");
  await writeTextFile(path.join(OUT_DIR, "404.html"), render404Page());

  const listPayload = await fetchJson(`${CMS_ORIGIN}/blogs/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: {},
  });

  const posts = Array.isArray(listPayload.data) ? listPayload.data : [];
  posts.sort((left, right) => {
    const leftTime = new Date(left.publishedAt || left.updatedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || right.updatedAt || 0).getTime();
    return rightTime - leftTime;
  });

  const preparedPosts = [];
  const assetState = {
    mediaDir: path.join(OUT_DIR, "assets", "media"),
    mediaCache: new Map(),
    writtenMediaFiles: new Set(),
  };

  for (const post of posts) {
    const shortUrl = cleanSlug(post.shortUrl || post.title || post.recordId, post.recordId);
    const detailPayload = await fetchJson(
      `${CMS_ORIGIN}/blogs?shortUrl=${encodeURIComponent(post.shortUrl)}`,
    );
    const detail = detailPayload.data || {};
    const localizedContent = await rewriteContentAssets(
      detail.content || "",
      assetState,
      "../../",
    );
    const localCoverUrl = await localizePossibleAssetUrl(
      detail.blogCoverUrl || post.blogCoverUrl || "",
      assetState,
      "./",
    );
    const localAuthorAvatar = await localizePossibleAssetUrl(
      detail.authorAvatar || post.authorAvatar || "",
      assetState,
      "./",
    );
    const articleCoverUrl = localCoverUrl
      ? localCoverUrl.replace(/^\.\/assets\//, "../../assets/")
      : "";
    const articleAuthorAvatar = localAuthorAvatar
      ? localAuthorAvatar.replace(/^\.\/assets\//, "../../assets/")
      : "";

    const prepared = {
      ...post,
      ...detail,
      shortUrl,
      outputDirName: shortUrl,
      localizedContent,
      localCoverUrl,
      localAuthorAvatar,
      articleCoverUrl,
      articleAuthorAvatar,
      authorName:
        detail.authorName ||
        post.authorName ||
        (Array.isArray(detail.authorList) && detail.authorList[0]?.name) ||
        "",
      seoTitle: detail.seoTitle || post.seoTitle || detail.title || post.title,
    };

    preparedPosts.push(prepared);

    const articleDir = path.join(OUT_DIR, "posts", shortUrl);
    await ensureDir(articleDir);
    await writeTextFile(path.join(articleDir, "index.html"), renderArticlePage(prepared));
  }

  await writeTextFile(path.join(OUT_DIR, "index.html"), renderIndexPage(preparedPosts));

  const indexData = preparedPosts.map((post) => ({
    shortUrl: post.shortUrl,
    title: post.title,
    subTitle: post.subTitle || "",
    type: post.type,
    publishedAt: post.publishedAt || "",
    updatedAt: post.updatedAt || "",
    authorName: post.authorName || "",
  }));
  await writeTextFile(
    path.join(OUT_DIR, "search-index.json"),
    JSON.stringify(indexData, null, 2),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outDir: OUT_DIR,
        siteOrigin: SITE_ORIGIN,
        postCount: preparedPosts.length,
      },
      null,
      2,
    ),
  );
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
