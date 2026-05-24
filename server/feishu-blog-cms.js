"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";
const execFileAsync = promisify(execFile);

const tokenCache = {
  value: "",
  expiresAt: 0,
};

const FIELD_MAP = {
  title: process.env.FEISHU_BLOG_FIELD_TITLE || "title",
  shortUrl: process.env.FEISHU_BLOG_FIELD_SHORT_URL || "shortUrl",
  subTitle: process.env.FEISHU_BLOG_FIELD_SUB_TITLE || "subTitle",
  type: process.env.FEISHU_BLOG_FIELD_TYPE || "type",
  status: process.env.FEISHU_BLOG_FIELD_STATUS || "status",
  blogCoverUrl: process.env.FEISHU_BLOG_FIELD_COVER_URL || "blogCoverUrl",
  seoTitle: process.env.FEISHU_BLOG_FIELD_SEO_TITLE || "seoTitle",
  seoDescription:
    process.env.FEISHU_BLOG_FIELD_SEO_DESCRIPTION || "seoDescription",
  seoTag: process.env.FEISHU_BLOG_FIELD_SEO_TAG || "seoTag",
  publishedAt: process.env.FEISHU_BLOG_FIELD_PUBLISHED_AT || "publishedAt",
  updatedAt: process.env.FEISHU_BLOG_FIELD_UPDATED_AT || "updatedAt",
  authorName: process.env.FEISHU_BLOG_FIELD_AUTHOR_NAME || "authorName",
  authorAvatar: process.env.FEISHU_BLOG_FIELD_AUTHOR_AVATAR || "authorAvatar",
  authorListJson:
    process.env.FEISHU_BLOG_FIELD_AUTHOR_LIST_JSON || "authorListJson",
  docUrl: process.env.FEISHU_BLOG_FIELD_DOC_URL || "docUrl",
  docToken: process.env.FEISHU_BLOG_FIELD_DOC_TOKEN || "docToken",
  publishedUrl: process.env.FEISHU_BLOG_FIELD_PUBLISHED_URL || "publishedUrl",
  contentHtml: process.env.FEISHU_BLOG_FIELD_CONTENT_HTML || "contentHtml",
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeString(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text.trim();
    }
    if (typeof value.name === "string") {
      return value.name.trim();
    }
    if (typeof value.url === "string") {
      return value.url.trim();
    }
    if (typeof value.link === "string") {
      return value.link.trim();
    }
  }

  return "";
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const markdownMatch = trimmed.match(/^!?\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
    return markdownMatch ? markdownMatch[1].trim() : trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const next = normalizeUrl(item);
      if (next) {
        return next;
      }
    }
    return "";
  }

  if (typeof value === "object") {
    if (typeof value.url === "string") {
      return value.url.trim();
    }
    if (typeof value.link === "string") {
      return value.link.trim();
    }
    if (typeof value.preview_url === "string") {
      return value.preview_url.trim();
    }
  }

  return "";
}

function extractXmlAttr(fragment, name) {
  const match = String(fragment || "").match(
    new RegExp(`${name}="([^"]*)"`, "i"),
  );
  return match ? match[1] : "";
}

function formatBytes(size) {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentLabelFromMime(mime) {
  const normalized = String(mime || "").toLowerCase();
  if (!normalized) {
    return "Attachment";
  }

  if (normalized.includes("spreadsheet") || normalized.includes("excel")) {
    return "Spreadsheet attachment";
  }

  if (normalized.includes("pdf")) {
    return "PDF attachment";
  }

  if (normalized.includes("word") || normalized.includes("document")) {
    return "Document attachment";
  }

  if (normalized.startsWith("image/")) {
    return "Image attachment";
  }

  return "Attachment";
}

function shouldProxyMediaUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return /(^|\.)feishu\.cn$/i.test(url.hostname);
  } catch (_) {
    return false;
  }
}

function buildMediaProxyUrl(options = {}) {
  const query = new URLSearchParams();
  const normalizedUrl = normalizeUrl(options.url);
  const token = normalizeString(options.token);
  const mime = normalizeString(options.mime);
  const filename = normalizeString(options.filename);

  if (normalizedUrl) {
    query.set("url", normalizedUrl);
  }
  if (token) {
    query.set("token", token);
  }
  if (mime) {
    query.set("mime", mime);
  }
  if (filename) {
    query.set("filename", filename);
  }

  return query.size ? `/cms/media?${query.toString()}` : "";
}

function toBrowserMediaUrl(value, options = {}) {
  const normalized = normalizeUrl(value);
  const token = normalizeString(options.token);
  const mime = normalizeString(options.mime);
  const filename = normalizeString(options.filename);

  if (token) {
    return buildMediaProxyUrl({
      url: normalized,
      token,
      mime,
      filename,
    });
  }

  if (!normalized) {
    return "";
  }

  if (!shouldProxyMediaUrl(normalized)) {
    return normalized;
  }

  return buildMediaProxyUrl({
    url: normalized,
    mime,
    filename,
  });
}

function parseLarkCliJsonOutput(stdout, stderr) {
  const trimmed = String(stdout || "").trim();

  const candidates = [trimmed];
  const lastJsonIndex = trimmed.lastIndexOf("\n{");
  if (lastJsonIndex >= 0) {
    candidates.push(trimmed.slice(lastJsonIndex + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Try the next parse shape.
    }
  }

  throw new Error(
    `Failed to parse lark-cli JSON output: ${stderr || stdout || "empty output"}`,
  );
}

function guessContentTypeFromPath(filePath, fallbackMime) {
  const explicit = normalizeString(fallbackMime).toLowerCase();
  if (explicit) {
    return explicit;
  }

  const extension = path.extname(String(filePath || "")).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return map[extension] || "application/octet-stream";
}

function sanitizeMediaBaseName(value) {
  const normalized = normalizeString(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    return "download";
  }

  return normalized.replace(/\.[a-z0-9]{2,8}$/i, "") || "download";
}

async function downloadDocMediaByToken(token, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "feishu-media-"));
  const outputBase = `./${sanitizeMediaBaseName(options.filename || token)}`;

  try {
    const { stdout, stderr } = await execFileAsync(
      "lark-cli",
      [
        "docs",
        "+media-download",
        "--as",
        "user",
        "--token",
        token,
        "--output",
        outputBase,
        "--overwrite",
      ],
      {
        cwd: tempDir,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const payload = parseLarkCliJsonOutput(stdout, stderr);
    if (!payload.ok || !payload.data?.saved_path) {
      throw new Error(
        payload?.error?.message ||
          "lark-cli media download succeeded without a saved path",
      );
    }

    const savedPath = path.isAbsolute(payload.data.saved_path)
      ? payload.data.saved_path
      : path.join(tempDir, payload.data.saved_path);
    const body = fs.readFileSync(savedPath);

    return {
      body,
      contentType: guessContentTypeFromPath(savedPath, payload.data.content_type),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function normalizeAuthors(fields) {
  const inlineJson = normalizeString(fields[FIELD_MAP.authorListJson]);
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      // Fall back to single-author fields.
    }
  }

  const name = normalizeString(fields[FIELD_MAP.authorName]);
  const profilePic = normalizeUrl(fields[FIELD_MAP.authorAvatar]);

  return name ? [{ name, profilePic }] : [];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rawTextToHtml(rawText) {
  const normalized = String(rawText || "").trim();
  if (!normalized) {
    return "<p>No content yet.</p>";
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("\n");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripMarkupToPlainText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const normalized = stripMarkupToPlainText(value);
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function comparableText(value) {
  return stripMarkupToPlainText(value)
    .toLowerCase()
    .replace(/^(title|标题)\s*[:：-]\s*/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input || {}, key);
}

function normalizeInputString(input, key, fallback = "") {
  return hasOwn(input, key) ? normalizeString(input[key]) : fallback;
}

function normalizeInputUrl(input, key, fallback = "") {
  return hasOwn(input, key) ? normalizeUrl(input[key]) : fallback;
}

function normalizeAnchorTag(attrs, innerHtml) {
  const href =
    normalizeUrl(extractXmlAttr(attrs, "href")) ||
    normalizeUrl(extractXmlAttr(attrs, "url")) ||
    normalizeUrl(extractXmlAttr(attrs, "data-href"));
  const inner = String(innerHtml || "").trim();

  if (!href) {
    return inner || stripMarkupToPlainText(innerHtml);
  }

  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner || escapeHtml(href)}</a>`;
}

function isHeadingLikeParagraph(innerHtml) {
  const inner = String(innerHtml || "").trim();
  const plain = stripMarkupToPlainText(inner);
  if (!plain || plain.length > 96) {
    return false;
  }

  if (
    /[:：]$/.test(plain) &&
    plain.length <= 32 &&
    !/<(a|ol|ul|li|img|figure|blockquote|pre|code|table)\b/i.test(inner)
  ) {
    return true;
  }

  if (/[。！？.!?]$/.test(plain)) {
    return false;
  }

  if (/<(a|ol|ul|li|img|figure|blockquote|pre|code|table)\b/i.test(inner)) {
    return false;
  }

  if (!/<(b|strong)\b/i.test(inner)) {
    return false;
  }

  const wrapperOnly = inner
    .replace(/<\/?(b|strong|span|em|i|u)\b[^>]*>/gi, "")
    .trim();

  return !/<[a-z]/i.test(wrapperOnly);
}

function standardizeContentHtml(value) {
  return String(value || "")
    .replace(/<cite\b([^>]*)>([\s\S]*?)<\/cite>/gi, (_, attrs, inner) => {
      const userName =
        extractXmlAttr(attrs, "user-name") ||
        extractXmlAttr(attrs, "name");
      const plain = stripMarkupToPlainText(inner) || userName;
      return plain
        ? `<span class="feishu-mention">@${escapeHtml(plain)}</span>`
        : "";
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_, label, href) => {
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    })
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, inner) => {
      return normalizeAnchorTag(attrs, inner);
    })
    .replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
      if (!isHeadingLikeParagraph(inner)) {
        return match;
      }

      return `<h3>${escapeHtml(stripMarkupToPlainText(inner))}</h3>`;
    })
    .replace(/<p>\s*(https?:\/\/[^\s<]+)\s*<\/p>/gi, (_, href) => {
      const safeHref = escapeHtml(href);
      return `<p><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeHref}</a></p>`;
    })
    .replace(/<span>\s*<\/span>/gi, "")
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "")
    .replace(/<h([1-3])>\s*<\/h\1>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
}

function extractDocMetaFromContent(rawContent) {
  const content = String(rawContent || "").trim();
  if (!content) {
    return {
      title: "",
      subTitle: "",
    };
  }

  if (content.includes("<")) {
    const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
    const titleFromTitleTag = stripMarkupToPlainText(titleMatch ? titleMatch[1] : "");
    const blocks = [];

    content.replace(
      /<(title|h1|h2|h3|p|li)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi,
      (_, tag, inner) => {
        const text = stripMarkupToPlainText(inner);
        if (text) {
          blocks.push({
            tag: String(tag || "").toLowerCase(),
            text,
          });
        }
        return "";
      },
    );

    const title =
      titleFromTitleTag ||
      (blocks.find((block) => block.tag === "h1") || {}).text ||
      (blocks[0] || {}).text ||
      "";

    const comparableTitle = comparableText(title);
    const subTitle =
      (
        blocks.find((block) => {
          if (!block.text || block.tag === "title") {
            return false;
          }

          const comparableBlockText = comparableText(block.text);
          if (!comparableBlockText) {
            return false;
          }

          if (comparableBlockText === comparableTitle) {
            return false;
          }

          if (
            comparableTitle &&
            (comparableTitle.includes(comparableBlockText) ||
              comparableBlockText.includes(comparableTitle))
          ) {
            return false;
          }

          return true;
        }) || {}
      ).text || "";

    return {
      title,
      subTitle: truncateText(subTitle, 180),
    };
  }

  const paragraphs = content
    .split(/\n{2,}/)
    .map((item) => stripMarkupToPlainText(item))
    .filter(Boolean);

  const title = paragraphs[0] || "";
  const subTitle = paragraphs.find((item) => item !== title) || "";

  return {
    title,
    subTitle: truncateText(subTitle, 180),
  };
}

function shouldUseLarkCli() {
  return process.env.FEISHU_USE_LARK_CLI === "1";
}

async function larkCliJson(args) {
  const { stdout, stderr } = await execFileAsync("lark-cli", args, {
    maxBuffer: 10 * 1024 * 1024,
  });

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Failed to parse lark-cli JSON output: ${stderr || stdout || error.message}`,
    );
  }

  if (!payload.ok) {
    throw new Error(
      payload?.error?.message || "lark-cli command failed without a detailed error",
    );
  }

  return payload.data;
}

function larkCliRowsToRecords(data) {
  const fields = Array.isArray(data.fields) ? data.fields : [];
  const rows = Array.isArray(data.data) ? data.data : [];
  const recordIds = Array.isArray(data.record_id_list) ? data.record_id_list : [];

  return rows.map((row, index) => {
    const values = Array.isArray(row) ? row : [];
    const fieldMap = {};

    fields.forEach((fieldName, fieldIndex) => {
      fieldMap[fieldName] = values[fieldIndex];
    });

    return {
      record_id: recordIds[index] || `record-${index + 1}`,
      fields: fieldMap,
    };
  });
}

function feishuXmlToHtml(xml) {
  const normalized = String(xml || "").trim();
  if (!normalized) {
    return "<p>No content yet.</p>";
  }

  return standardizeContentHtml(
    normalized
    .replace(/<figure\b([^>]*)>\s*<source\b([^>]*)\/?>\s*<\/figure>/gi, (_, figureAttrs, sourceAttrs) => {
      const src =
        extractXmlAttr(sourceAttrs, "href") ||
        extractXmlAttr(sourceAttrs, "url") ||
        extractXmlAttr(sourceAttrs, "src");
      if (!src) {
        return "";
      }

      const mime = extractXmlAttr(sourceAttrs, "mime");
      const token = extractXmlAttr(sourceAttrs, "token");
      const filename =
        extractXmlAttr(sourceAttrs, "name") ||
        extractXmlAttr(sourceAttrs, "filename");
      const size = formatBytes(extractXmlAttr(sourceAttrs, "size"));
      const sourceType = attachmentLabelFromMime(mime);
      const browserSrc = toBrowserMediaUrl(src, {
        token,
        mime,
        filename,
      });

      if (String(mime || "").toLowerCase().startsWith("image/")) {
        return `<img src="${escapeHtml(browserSrc)}" alt="" loading="lazy" class="feishu-inline-image">`;
      }

      const meta = [mime || "", size || "", token ? `token: ${token}` : ""]
        .filter(Boolean)
        .join(" · ");

      return [
        '<div class="feishu-file-card">',
        `<div class="feishu-file-card__title">${escapeHtml(sourceType)}</div>`,
        meta
          ? `<div class="feishu-file-card__meta">${escapeHtml(meta)}</div>`
          : "",
        `<a class="feishu-file-card__link" href="${escapeHtml(browserSrc)}" target="_blank" rel="noopener noreferrer">Open attachment</a>`,
        "</div>",
      ].join("");
    })
    .replace(/<img\b([^>]*)\/?>/gi, (_, attrs) => {
      const src =
        extractXmlAttr(attrs, "url") ||
        extractXmlAttr(attrs, "href") ||
        extractXmlAttr(attrs, "src");
      if (!src) {
        return "";
      }

      const existingClass = extractXmlAttr(attrs, "class");
      if (
        String(existingClass).includes("feishu-inline-image") ||
        String(src).startsWith("/cms/media")
      ) {
        return `<img${attrs}>`;
      }

      const token = extractXmlAttr(attrs, "token");
      const mime = extractXmlAttr(attrs, "mime");
      const filename =
        extractXmlAttr(attrs, "name") ||
        extractXmlAttr(attrs, "filename");
      const width = extractXmlAttr(attrs, "width");
      const height = extractXmlAttr(attrs, "height");
      const browserSrc = toBrowserMediaUrl(src, {
        token,
        mime,
        filename,
      });
      const sizeAttrs = [
        width ? ` width="${escapeHtml(width)}"` : "",
        height ? ` height="${escapeHtml(height)}"` : "",
      ].join("");

      return `<img src="${escapeHtml(browserSrc)}" alt="" loading="lazy" class="feishu-inline-image"${sizeAttrs}>`;
    })
    .replace(/!\[\]\((https?:\/\/[^)]+)\)/gi, (_, src) => {
      return `<img src="${escapeHtml(toBrowserMediaUrl(src))}" alt="" loading="lazy" class="feishu-inline-image">`;
    })
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(
      /<callout\b[^>]*>/g,
      '<div class="feishu-callout" style="margin:0 0 20px;padding:16px 18px;border-radius:16px;background:rgba(142,246,60,0.12);border:1px solid rgba(142,246,60,0.28);">',
    )
    .replace(/<\/callout>/g, "</div>")
    .replace(/<(h1|h2|h3)(\s+[^>]*)?>\s*<br\s*\/?>/gi, "<$1>")
    .replace(/<(h1|h2|h3)>([\s\S]*?)<(ol|ul)>/gi, "<$1>$2</$1><$3>")
    .replace(/<\/(ol|ul)>\s*<\/(h1|h2|h3)>/gi, "</$1>")
    .replace(/<p>([\s\S]*?)<(ol|ul)>/gi, "<p>$1</p><$2>")
    .replace(/<\/(ol|ul)>\s*<\/p>/gi, "</$1>")
    .replace(/<(h1|h2|h3|p|ul|ol|li|blockquote|pre|code|strong|em|span)(\s+[^>]*)?>/g, "<$1>")
    .replace(/<hr\s*\/>/g, "<hr />")
    .replace(/<h([1-3])>\s*<\/h\1>/gi, "")
    .replace(/<p>\s*<\/p>/g, "")
    .trim(),
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function extractDocxTokenFromUrl(value) {
  const match = String(value || "").match(/\/docx\/([^/?#]+)/i);
  return match ? match[1] : "";
}

function extractWikiTokenFromUrl(value) {
  const match = String(value || "").match(/\/wiki\/([^/?#]+)/i);
  return match ? match[1] : "";
}

function normalizeBlogType(value) {
  return normalizeString(value) === "1" ? "1" : "0";
}

function normalizePublishStatus(value) {
  return normalizeStatus(value) === "draft" ? "draft" : "published";
}

function slugifyText(value) {
  return normalizeString(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function timestampSlug() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

function inferDocSourceType(docRef) {
  if (extractWikiTokenFromUrl(docRef)) {
    return "wiki";
  }

  if (extractDocxTokenFromUrl(docRef)) {
    return "docx";
  }

  return "unknown";
}

function buildUniqueShortUrl(existingRecords, requestedShortUrl, title) {
  const existing = new Set(
    existingRecords.map((record) => normalizeString(record.shortUrl)).filter(Boolean),
  );

  const requested = slugifyText(requestedShortUrl);
  const titleBased = slugifyText(title);
  const base = requested || titleBased || `post-${timestampSlug()}`;

  if (!existing.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

async function buildCreateFields(input, existingRecords) {
  const docUrl = normalizeString(input.docUrl);

  if (!docUrl) {
    throw new Error("docUrl is required");
  }

  if (
    !extractDocxTokenFromUrl(docUrl) &&
    !extractWikiTokenFromUrl(docUrl) &&
    !normalizeUrl(input.publishedUrl)
  ) {
    throw new Error("docUrl must be a Feishu wiki or docx link");
  }

  const docSource = await fetchDocSource(docUrl);
  const extractedDocMeta = extractDocMetaFromContent(docSource.rawContent);
  const title =
    normalizeString(input.title) ||
    normalizeString(docSource.title) ||
    extractedDocMeta.title;
  const subTitle =
    normalizeString(input.subTitle) || extractedDocMeta.subTitle || "";

  if (!title) {
    throw new Error("title is required");
  }

  const shortUrl = buildUniqueShortUrl(existingRecords, input.shortUrl, title);
  const now = new Date().toISOString();

  return {
    [FIELD_MAP.title]: title,
    [FIELD_MAP.shortUrl]: shortUrl,
    [FIELD_MAP.subTitle]: subTitle,
    [FIELD_MAP.type]: normalizeBlogType(input.type),
    [FIELD_MAP.status]: normalizePublishStatus(input.status),
    [FIELD_MAP.blogCoverUrl]: normalizeUrl(input.blogCoverUrl),
    [FIELD_MAP.seoTitle]: normalizeString(input.seoTitle) || title,
    [FIELD_MAP.seoDescription]:
      normalizeString(input.seoDescription) || subTitle || title,
    [FIELD_MAP.seoTag]: normalizeString(input.seoTag),
    [FIELD_MAP.publishedAt]: now,
    [FIELD_MAP.updatedAt]: now,
    [FIELD_MAP.authorName]: normalizeString(input.authorName),
    [FIELD_MAP.authorAvatar]: normalizeUrl(input.authorAvatar),
    [FIELD_MAP.authorListJson]: normalizeString(input.authorListJson),
    [FIELD_MAP.docUrl]: docUrl,
    [FIELD_MAP.docToken]: "",
    [FIELD_MAP.publishedUrl]: normalizeUrl(input.publishedUrl),
    [FIELD_MAP.contentHtml]: normalizeString(input.contentHtml),
  };
}

async function resolveDocTokenForOpenApi(docRef) {
  if (!docRef) {
    return "";
  }

  if (!isHttpUrl(docRef)) {
    return docRef;
  }

  const directDocxToken = extractDocxTokenFromUrl(docRef);
  if (directDocxToken) {
    return directDocxToken;
  }

  const wikiToken = extractWikiTokenFromUrl(docRef);
  if (wikiToken) {
    const query = new URLSearchParams({
      token: wikiToken,
      obj_type: "wiki",
    });
    const data = await feishuRequest(
      "GET",
      `/wiki/v2/spaces/get_node?${query.toString()}`,
    );

    if (data.node?.obj_type !== "docx" || !data.node?.obj_token) {
      throw new Error("The wiki URL does not point to a docx document.");
    }

    return data.node.obj_token;
  }

  throw new Error("Unsupported document URL format.");
}

function readMockRecords() {
  const mockPath = process.env.FEISHU_BLOG_MOCK_JSON;
  if (!mockPath) {
    return null;
  }

  const content = fs.readFileSync(mockPath, "utf8");
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.records)) {
    return parsed.records;
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }

  return [];
}

async function fetchDocSource(docRef) {
  if (shouldUseLarkCli()) {
    const doc = await larkCliJson([
      "docs",
      "+fetch",
      "--as",
      "user",
      "--api-version",
      "v2",
      "--doc",
      docRef,
      "--detail",
      "full",
    ]);

    return {
      title: normalizeString(doc.document?.title),
      rawContent: normalizeString(doc.document?.content),
      sourceType: inferDocSourceType(docRef),
    };
  }

  const resolvedDocToken = await resolveDocTokenForOpenApi(docRef);
  const doc = await feishuRequest(
    "GET",
    `/docx/v1/documents/${resolvedDocToken}/raw_content`,
  );

  return {
    title: "",
    rawContent: normalizeString(doc.content),
    sourceType: inferDocSourceType(docRef),
  };
}

async function getTenantAccessToken() {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const appId = requiredEnv("FEISHU_APP_ID");
  const appSecret = requiredEnv("FEISHU_APP_SECRET");

  const response = await fetch(
    `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(
      `Failed to get tenant access token: ${data.msg || response.statusText}`,
    );
  }

  tokenCache.value = data.tenant_access_token;
  tokenCache.expiresAt = now + Math.max((data.expire - 120) * 1000, 60 * 1000);

  return tokenCache.value;
}

async function feishuRequest(method, path, body) {
  const tenantAccessToken = await getTenantAccessToken();
  const response = await fetch(`${FEISHU_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || `Feishu API request failed: ${response.status}`);
  }
  return data.data;
}

async function fetchAllRecords() {
  const mockRecords = readMockRecords();
  if (mockRecords) {
    return mockRecords;
  }

  const appToken = requiredEnv("FEISHU_BLOG_BASE_APP_TOKEN");
  const tableId = requiredEnv("FEISHU_BLOG_BASE_TABLE_ID");

  if (shouldUseLarkCli()) {
    const items = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await larkCliJson([
        "base",
        "+record-list",
        "--as",
        "user",
        "--base-token",
        appToken,
        "--table-id",
        tableId,
        "--format",
        "json",
        "--limit",
        "200",
        "--offset",
        String(offset),
      ]);

      const pageItems = larkCliRowsToRecords(data);
      items.push(...pageItems);
      hasMore = Boolean(data.has_more);
      offset += pageItems.length;

      if (!pageItems.length) {
        break;
      }
    }

    return items;
  }

  const items = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const query = new URLSearchParams({
      page_size: "500",
    });

    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const data = await feishuRequest(
      "GET",
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?${query.toString()}`,
    );

    items.push(...(data.items || []));
    hasMore = Boolean(data.has_more);
    pageToken = data.page_token || "";
  }

  return items;
}

async function createRecord(fields) {
  const appToken = requiredEnv("FEISHU_BLOG_BASE_APP_TOKEN");
  const tableId = requiredEnv("FEISHU_BLOG_BASE_TABLE_ID");

  if (shouldUseLarkCli()) {
    return larkCliJson([
      "base",
      "+record-upsert",
      "--as",
      "user",
      "--base-token",
      appToken,
      "--table-id",
      tableId,
      "--json",
      JSON.stringify(fields),
    ]);
  }

  return feishuRequest(
    "POST",
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    { fields },
  );
}

async function updateRecord(recordId, fields) {
  const appToken = requiredEnv("FEISHU_BLOG_BASE_APP_TOKEN");
  const tableId = requiredEnv("FEISHU_BLOG_BASE_TABLE_ID");

  if (shouldUseLarkCli()) {
    return larkCliJson([
      "base",
      "+record-upsert",
      "--as",
      "user",
      "--base-token",
      appToken,
      "--table-id",
      tableId,
      "--record-id",
      recordId,
      "--json",
      JSON.stringify(fields),
    ]);
  }

  return feishuRequest(
    "PUT",
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { fields },
  );
}

function normalizeType(value) {
  return normalizeString(value);
}

function normalizeStatus(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeRecord(item) {
  if (item.shortUrl && item.title && !item.fields) {
    const authorList = Array.isArray(item.authorList)
      ? item.authorList
      : normalizeAuthors({
          [FIELD_MAP.authorListJson]: item.authorListJson || "",
          [FIELD_MAP.authorName]: item.authorName || "",
          [FIELD_MAP.authorAvatar]: item.authorAvatar || "",
        });

    return {
      recordId: item.recordId || item.blogId || item.shortUrl,
      blogId: item.blogId || item.recordId || item.shortUrl,
      shortUrl: item.shortUrl,
      title: item.title,
      subTitle: item.subTitle || "",
      type: normalizeType(item.type),
      status: normalizeStatus(item.status) || "published",
      blogCoverUrl: item.blogCoverUrl || "",
      seoTitle: item.seoTitle || item.title,
      seoDescription: item.seoDescription || item.subTitle || item.title,
      seoTag: item.seoTag || "",
      publishedAt: item.publishedAt || item.updateDate || "",
      updatedAt: item.updatedAt || item.publishedAt || item.updateDate || "",
      updateDate: item.updatedAt || item.publishedAt || item.updateDate || "",
      docUrl: item.docUrl || "",
      docToken: item.docToken || "",
      publishedUrl: item.publishedUrl || "",
      contentHtml: item.contentHtml || "",
      authorName: item.authorName || (authorList[0] || {}).name || "",
      authorAvatar: item.authorAvatar || (authorList[0] || {}).profilePic || "",
      authorList,
    };
  }

  const fields = item.fields || {};
  const shortUrl = normalizeString(fields[FIELD_MAP.shortUrl]);
  const title = normalizeString(fields[FIELD_MAP.title]);
  const subTitle = normalizeString(fields[FIELD_MAP.subTitle]);
  const type = normalizeType(fields[FIELD_MAP.type]);
  const status = normalizeStatus(fields[FIELD_MAP.status]) || "published";
  const cover = normalizeUrl(fields[FIELD_MAP.blogCoverUrl]);
  const seoTitle = normalizeString(fields[FIELD_MAP.seoTitle]) || title;
  const seoDescription =
    normalizeString(fields[FIELD_MAP.seoDescription]) || subTitle || title;
  const seoTag = normalizeString(fields[FIELD_MAP.seoTag]);
  const publishedAt =
    normalizeString(fields[FIELD_MAP.publishedAt]) ||
    item.last_modified_time ||
    item.created_time ||
    "";
  const updatedAt =
    normalizeString(fields[FIELD_MAP.updatedAt]) ||
    publishedAt ||
    item.last_modified_time ||
    item.created_time ||
    "";
  const docUrl = normalizeString(fields[FIELD_MAP.docUrl]);
  const docToken = normalizeString(fields[FIELD_MAP.docToken]);
  const publishedUrl = normalizeUrl(fields[FIELD_MAP.publishedUrl]);
  const contentHtml = normalizeString(fields[FIELD_MAP.contentHtml]);
  const authors = normalizeAuthors(fields);

  return {
    recordId: item.record_id,
    blogId: item.record_id,
    shortUrl,
    title,
    subTitle,
    type,
    status,
    blogCoverUrl: cover,
    seoTitle,
    seoDescription,
    seoTag,
    publishedAt,
    updatedAt,
    updateDate: updatedAt || publishedAt,
    docUrl,
    docToken,
    publishedUrl,
    contentHtml,
    authorName: normalizeString(fields[FIELD_MAP.authorName]),
    authorAvatar: normalizeUrl(fields[FIELD_MAP.authorAvatar]),
    authorList: authors,
  };
}

function filterAndSortBlogs(records, options) {
  const normalizedType = options.type == null ? "" : String(options.type);
  const rawStatus =
    options.status == null ? "published" : String(options.status).toLowerCase();
  const status = rawStatus === "all" ? "" : rawStatus;

  return records
    .map(normalizeRecord)
    .filter((record) => record.shortUrl && record.title)
    .filter((record) => !status || record.status === status)
    .filter((record) => !normalizedType || record.type === normalizedType)
    .sort((left, right) => {
      return new Date(right.updateDate).getTime() - new Date(left.updateDate).getTime();
    });
}

async function resolveBlogContent(record) {
  if (record.contentHtml) {
    return standardizeContentHtml(record.contentHtml);
  }

  const docRef = record.docUrl || record.docToken;

  if (docRef) {
    const docSource = await fetchDocSource(docRef);
    return shouldUseLarkCli()
      ? feishuXmlToHtml(docSource.rawContent)
      : standardizeContentHtml(rawTextToHtml(docSource.rawContent));
  }

  if (record.publishedUrl) {
    const url = escapeHtml(record.publishedUrl);
    return [
      '<div class="feishu-doc-embed">',
      `<iframe src="${url}" style="width:100%;min-height:900px;border:0;" loading="lazy"></iframe>`,
      "</div>",
    ].join("");
  }

  return "<p>No content linked yet.</p>";
}

async function handleBlogsList(req, res) {
  const body = await parseBody(req);
  const filterType =
    body?.filter?.find((item) => item.fieldName === "type")?.fieldValue || "";
  const filterStatus =
    body?.filter?.find((item) => item.fieldName === "status")?.fieldValue;
  const pageNumber = Number(body.pageNumber || 1);
  const pageSize = Number(body.pageSize || 100);

  const allRecords = await fetchAllRecords();
  const blogs = filterAndSortBlogs(allRecords, {
    type: filterType,
    status: filterStatus,
  });
  const offset = Math.max(pageNumber - 1, 0) * pageSize;
  const pagedBlogs = blogs.slice(offset, offset + pageSize);

  json(res, 200, {
    code: 0,
    msg: "success",
    data: pagedBlogs,
    total: blogs.length,
  });
}

async function handleBlogDetail(req, res, url) {
  const shortUrl = url.searchParams.get("shortUrl");
  if (!shortUrl) {
    json(res, 400, {
      code: 400,
      msg: "shortUrl is required",
    });
    return;
  }

  const allRecords = await fetchAllRecords();
  const allowDraft = url.searchParams.get("includeDraft") === "1";
  const record = filterAndSortBlogs(allRecords, {
    status: allowDraft ? "all" : "published",
  }).find((item) => item.shortUrl === shortUrl);

  if (!record) {
    json(res, 404, {
      code: 404,
      msg: `Blog not found: ${shortUrl}`,
    });
    return;
  }

  const content = await resolveBlogContent(record);

  json(res, 200, {
    code: 0,
    msg: "success",
    data: {
      recordId: record.recordId,
      blogId: record.blogId,
      updateDate: record.updateDate,
      publishedAt: record.publishedAt,
      updatedAt: record.updatedAt,
      title: record.title,
      subTitle: record.subTitle,
      shortUrl: record.shortUrl,
      type: record.type,
      status: record.status,
      docUrl: record.docUrl,
      docToken: record.docToken,
      publishedUrl: record.publishedUrl,
      authorName: record.authorName,
      authorAvatar: record.authorAvatar,
      blogCoverUrl: record.blogCoverUrl,
      authorList: record.authorList,
      content,
      seoTag: record.seoTag,
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
    },
  });
}

async function handleDocMeta(req, res) {
  const body = await parseBody(req);
  const docUrl = normalizeString(body.docUrl);

  if (!docUrl) {
    json(res, 400, {
      code: 400,
      msg: "docUrl is required",
    });
    return;
  }

  const docSource = await fetchDocSource(docUrl);
  const docMeta = extractDocMetaFromContent(docSource.rawContent);
  const title = normalizeString(docSource.title) || docMeta.title;

  json(res, 200, {
    code: 0,
    msg: "success",
    data: {
      title,
      subTitle: docMeta.subTitle,
      shortUrl: slugifyText(title),
      sourceType: docSource.sourceType,
    },
  });
}

async function handleMediaProxy(req, res, url) {
  const sourceUrl = url.searchParams.get("url");
  const token = normalizeString(url.searchParams.get("token"));
  const mime = normalizeString(url.searchParams.get("mime"));
  const filename = normalizeString(url.searchParams.get("filename"));
  if (!sourceUrl && !token) {
    json(res, 400, {
      code: 400,
      msg: "url or token is required",
    });
    return;
  }

  if (token && shouldUseLarkCli()) {
    try {
      const media = await downloadDocMediaByToken(token, { mime, filename });
      res.statusCode = 200;
      res.setHeader("Content-Type", media.contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.end(media.body);
      return;
    } catch (error) {
      if (!sourceUrl) {
        json(res, 502, {
          code: 502,
          msg: `Failed to load token media: ${error.message}`,
        });
        return;
      }
    }
  }

  if (!shouldProxyMediaUrl(sourceUrl)) {
    json(res, 400, {
      code: 400,
      msg: "unsupported media host",
    });
    return;
  }

  const upstream = await fetch(sourceUrl);
  if (!upstream.ok) {
    json(res, upstream.status, {
      code: upstream.status,
      msg: `Failed to load media: ${upstream.statusText}`,
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") ||
      guessContentTypeFromPath(filename, mime),
  );
  res.setHeader("Cache-Control", "private, max-age=300");
  const body = Buffer.from(await upstream.arrayBuffer());
  res.end(body);
}

async function handleBlogCreate(req, res) {
  const body = await parseBody(req);
  const existingRecords = filterAndSortBlogs(await fetchAllRecords(), {
    status: "all",
  });
  const fields = await buildCreateFields(body, existingRecords);

  await createRecord(fields);

  json(res, 200, {
    code: 0,
    msg: "success",
    data: {
      title: fields[FIELD_MAP.title],
      shortUrl: fields[FIELD_MAP.shortUrl],
      subTitle: fields[FIELD_MAP.subTitle],
      type: fields[FIELD_MAP.type],
      status: fields[FIELD_MAP.status],
      docUrl: fields[FIELD_MAP.docUrl],
    },
  });
}

async function buildUpdateFields(input, currentRecord, existingRecords) {
  const docUrl =
    normalizeInputString(input, "docUrl", currentRecord.docUrl) ||
    currentRecord.docUrl;
  const docSource = docUrl ? await fetchDocSource(docUrl) : null;
  const extractedDocMeta = docSource
    ? extractDocMetaFromContent(docSource.rawContent)
    : { title: currentRecord.title, subTitle: currentRecord.subTitle };
  const title =
    normalizeInputString(input, "title", currentRecord.title) ||
    normalizeString(docSource?.title) ||
    extractedDocMeta.title ||
    currentRecord.title;
  const subTitle = hasOwn(input, "subTitle")
    ? normalizeString(input.subTitle)
    : currentRecord.subTitle || extractedDocMeta.subTitle || "";

  if (!title) {
    throw new Error("title is required");
  }

  const siblingRecords = existingRecords.filter(
    (record) => record.recordId !== currentRecord.recordId,
  );
  const shortUrl = buildUniqueShortUrl(
    siblingRecords,
    normalizeInputString(input, "shortUrl", currentRecord.shortUrl),
    title,
  );
  const nextStatus = normalizePublishStatus(
    normalizeInputString(input, "status", currentRecord.status),
  );
  const now = new Date().toISOString();
  const nextPublishedAt =
    nextStatus === "published"
      ? currentRecord.publishedAt || currentRecord.updateDate || now
      : currentRecord.publishedAt || "";

  return {
    [FIELD_MAP.title]: title,
    [FIELD_MAP.shortUrl]: shortUrl,
    [FIELD_MAP.subTitle]: subTitle,
    [FIELD_MAP.type]: normalizeBlogType(
      normalizeInputString(input, "type", currentRecord.type),
    ),
    [FIELD_MAP.status]: nextStatus,
    [FIELD_MAP.blogCoverUrl]: normalizeInputUrl(
      input,
      "blogCoverUrl",
      currentRecord.blogCoverUrl,
    ),
    [FIELD_MAP.seoTitle]:
      normalizeInputString(input, "seoTitle") || currentRecord.seoTitle || title,
    [FIELD_MAP.seoDescription]:
      normalizeInputString(input, "seoDescription") ||
      currentRecord.seoDescription ||
      subTitle ||
      title,
    [FIELD_MAP.seoTag]:
      normalizeInputString(input, "seoTag", currentRecord.seoTag),
    [FIELD_MAP.publishedAt]: nextPublishedAt,
    [FIELD_MAP.updatedAt]: now,
    [FIELD_MAP.authorName]: normalizeInputString(
      input,
      "authorName",
      currentRecord.authorName,
    ),
    [FIELD_MAP.authorAvatar]: normalizeInputUrl(
      input,
      "authorAvatar",
      currentRecord.authorAvatar,
    ),
    [FIELD_MAP.authorListJson]:
      normalizeInputString(input, "authorListJson", ""),
    [FIELD_MAP.docUrl]: docUrl,
    [FIELD_MAP.docToken]: "",
    [FIELD_MAP.publishedUrl]: normalizeInputUrl(
      input,
      "publishedUrl",
      currentRecord.publishedUrl,
    ),
    [FIELD_MAP.contentHtml]: normalizeInputString(
      input,
      "contentHtml",
      currentRecord.contentHtml,
    ),
  };
}

async function handleBlogUpdate(req, res) {
  const body = await parseBody(req);
  const recordId = normalizeString(body.recordId);
  if (!recordId) {
    json(res, 400, {
      code: 400,
      msg: "recordId is required",
    });
    return;
  }

  const existingRecords = filterAndSortBlogs(await fetchAllRecords(), {
    status: "all",
  });
  const currentRecord = existingRecords.find((item) => item.recordId === recordId);
  if (!currentRecord) {
    json(res, 404, {
      code: 404,
      msg: `Blog not found: ${recordId}`,
    });
    return;
  }

  const fields = await buildUpdateFields(body, currentRecord, existingRecords);
  await updateRecord(recordId, fields);

  json(res, 200, {
    code: 0,
    msg: "success",
    data: {
      recordId,
      title: fields[FIELD_MAP.title],
      shortUrl: fields[FIELD_MAP.shortUrl],
      subTitle: fields[FIELD_MAP.subTitle],
      type: fields[FIELD_MAP.type],
      status: fields[FIELD_MAP.status],
      docUrl: fields[FIELD_MAP.docUrl],
    },
  });
}

module.exports = async function feishuBlogCms(req, res, next) {
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "POST" && url.pathname === "/blogs/list") {
      await handleBlogsList(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/blogs") {
      await handleBlogDetail(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/cms/doc-meta") {
      await handleDocMeta(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/cms/media") {
      await handleMediaProxy(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/cms/articles") {
      await handleBlogCreate(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/cms/articles/update") {
      await handleBlogUpdate(req, res);
      return;
    }

    if (typeof next === "function") {
      next();
      return;
    }

    json(res, 404, {
      code: 404,
      msg: "Not found",
    });
  } catch (error) {
    json(res, 500, {
      code: 500,
      msg: error.message,
    });
  }
};
