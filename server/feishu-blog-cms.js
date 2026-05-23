"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
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

  return normalized
    .replace(/<img\b([^>]*)\/?>/gi, (_, attrs) => {
      const src =
        extractXmlAttr(attrs, "url") ||
        extractXmlAttr(attrs, "href") ||
        extractXmlAttr(attrs, "src");
      if (!src) {
        return "";
      }

      const width = extractXmlAttr(attrs, "width");
      const height = extractXmlAttr(attrs, "height");
      const style =
        "display:block;max-width:100%;height:auto;margin:20px 0;border-radius:16px;";

      const sizeAttrs = [
        width ? ` width="${escapeHtml(width)}"` : "",
        height ? ` height="${escapeHtml(height)}"` : "",
      ].join("");

      return `<img src="${escapeHtml(src)}" alt="" loading="lazy" style="${style}"${sizeAttrs}>`;
    })
    .replace(/!\[\]\((https?:\/\/[^)]+)\)/gi, (_, src) => {
      return `<img src="${escapeHtml(src)}" alt="" loading="lazy" style="display:block;max-width:100%;height:auto;margin:20px 0;border-radius:16px;">`;
    })
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(
      /<callout\b[^>]*>/g,
      '<div class="feishu-callout" style="margin:0 0 20px;padding:16px 18px;border-radius:16px;background:rgba(142,246,60,0.12);border:1px solid rgba(142,246,60,0.28);">',
    )
    .replace(/<\/callout>/g, "</div>")
    .replace(/<(h1|h2|h3|p|ul|ol|li|blockquote|pre|code|strong|em|span)(\s+[^>]*)?>/g, "<$1>")
    .replace(/<hr\s*\/>/g, "<hr />")
    .trim();
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

function normalizeType(value) {
  return normalizeString(value);
}

function normalizeStatus(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeRecord(item) {
  if (item.shortUrl && item.title && !item.fields) {
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
      updateDate: item.updatedAt || item.updateDate || "",
      docUrl: item.docUrl || "",
      docToken: item.docToken || "",
      publishedUrl: item.publishedUrl || "",
      contentHtml: item.contentHtml || "",
      authorList: Array.isArray(item.authorList)
        ? item.authorList
        : normalizeAuthors({
            [FIELD_MAP.authorListJson]: item.authorListJson || "",
            [FIELD_MAP.authorName]: item.authorName || "",
            [FIELD_MAP.authorAvatar]: item.authorAvatar || "",
          }),
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
    normalizeString(fields[FIELD_MAP.updatedAt]) ||
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
    updateDate: publishedAt,
    docUrl,
    docToken,
    publishedUrl,
    contentHtml,
    authorList: authors,
  };
}

function filterAndSortBlogs(records, options) {
  const normalizedType = options.type == null ? "" : String(options.type);
  const status = (options.status || "published").toLowerCase();

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
    return record.contentHtml;
  }

  const docRef = record.docUrl || record.docToken;

  if (docRef) {
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
        "--format",
        "json",
      ]);
      return feishuXmlToHtml(doc.document?.content || "");
    }

    const resolvedDocToken = await resolveDocTokenForOpenApi(docRef);
    const doc = await feishuRequest(
      "GET",
      `/docx/v1/documents/${resolvedDocToken}/raw_content`,
    );
    return rawTextToHtml(doc.content);
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
  const pageNumber = Number(body.pageNumber || 1);
  const pageSize = Number(body.pageSize || 100);

  const allRecords = await fetchAllRecords();
  const blogs = filterAndSortBlogs(allRecords, { type: filterType });
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
  const record = filterAndSortBlogs(allRecords, { status: "published" }).find(
    (item) => item.shortUrl === shortUrl,
  );

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
      updateDate: record.updateDate,
      title: record.title,
      subTitle: record.subTitle,
      shortUrl: record.shortUrl,
      blogCoverUrl: record.blogCoverUrl,
      authorList: record.authorList,
      content,
      seoTag: record.seoTag,
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
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
