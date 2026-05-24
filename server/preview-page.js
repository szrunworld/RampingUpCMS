"use strict";

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feishu Blog CMS Preview</title>
  <style>
    :root {
      --bg: #0f1115;
      --panel: #171a21;
      --line: #2c3240;
      --text: #f4f7fb;
      --muted: #98a2b3;
      --brand: #8ef63c;
      --danger: #ff7a7a;
      --success: #8ef63c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(142,246,60,0.12), transparent 30%),
        linear-gradient(180deg, #0f1115 0%, #12151d 100%);
      color: var(--text);
      font-family: "Avenir Next", "SF Pro Text", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .shell { width: min(1200px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0 64px; }
    .hero { display:flex; justify-content:space-between; gap:24px; align-items:end; margin-bottom:28px; }
    .hero h1 { margin:0; font-size:clamp(36px,5vw,64px); line-height:0.95; letter-spacing:-0.03em; }
    .hero h1 span { color: var(--brand); }
    .hero p { margin:0; max-width:560px; color:var(--muted); line-height:1.75; }
    .toolbar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
    .toolbar:last-of-type { margin-bottom:24px; }
    .toolbar button {
      border:1px solid var(--line);
      background:rgba(255,255,255,0.02);
      color:var(--text);
      border-radius:999px;
      padding:10px 14px;
      cursor:pointer;
    }
    .toolbar button.active {
      background:var(--brand);
      color:#0d0f13;
      border-color:var(--brand);
      font-weight:700;
    }
    .composer {
      margin-bottom:24px;
      background:rgba(23,26,33,0.9);
      border:1px solid var(--line);
      border-radius:24px;
      padding:20px 22px 22px;
      backdrop-filter:blur(10px);
    }
    .composer summary {
      cursor:pointer;
      list-style:none;
      font-size:18px;
      font-weight:700;
    }
    .composer summary::-webkit-details-marker { display:none; }
    .composer summary::after {
      content:"+";
      float:right;
      color:var(--brand);
      font-size:24px;
      line-height:1;
    }
    .composer[open] summary::after { content:"-"; }
    .composer-mode-badge {
      display:inline-flex;
      align-items:center;
      margin-left:10px;
      padding:4px 10px;
      border-radius:999px;
      font-size:12px;
      letter-spacing:0.08em;
      text-transform:uppercase;
      background:rgba(142,246,60,0.12);
      color:var(--brand);
      border:1px solid rgba(142,246,60,0.25);
      vertical-align:middle;
    }
    .composer-intro {
      margin:14px 0 18px;
      color:var(--muted);
      line-height:1.75;
    }
    .composer-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:14px;
    }
    .field { display:flex; flex-direction:column; gap:8px; }
    .field-wide { grid-column:1 / -1; }
    .field label {
      font-size:13px;
      color:var(--muted);
    }
    .field input,
    .field select,
    .field textarea {
      width:100%;
      border:1px solid var(--line);
      background:#10131a;
      color:var(--text);
      border-radius:14px;
      padding:12px 14px;
      font:inherit;
    }
    .field textarea {
      min-height:88px;
      resize:vertical;
    }
    .field .hint {
      font-size:12px;
      color:var(--muted);
      line-height:1.6;
    }
    .input-row {
      display:flex;
      gap:10px;
      align-items:stretch;
    }
    .input-row input { flex:1; }
    .ghost-button {
      border:1px solid var(--line);
      background:rgba(255,255,255,0.02);
      color:var(--text);
      border-radius:14px;
      padding:0 16px;
      font:inherit;
      cursor:pointer;
      white-space:nowrap;
    }
    .ghost-button[disabled] {
      opacity:0.6;
      cursor:wait;
    }
    .ghost-button.is-hidden {
      display:none;
    }
    .primary-ghost {
      border-color:rgba(142,246,60,0.35);
      background:rgba(142,246,60,0.12);
    }
    .composer-actions {
      display:flex;
      align-items:center;
      gap:14px;
      margin-top:16px;
      flex-wrap:wrap;
    }
    .composer-actions button[type="submit"] {
      border:0;
      background:var(--brand);
      color:#0d0f13;
      font-weight:700;
      border-radius:999px;
      padding:12px 18px;
      cursor:pointer;
    }
    .composer-actions button[disabled] {
      opacity:0.6;
      cursor:wait;
    }
    .composer-status,
    .doc-meta-status {
      font-size:13px;
      color:var(--muted);
      line-height:1.6;
    }
    .composer-status.error,
    .doc-meta-status.error { color: var(--danger); }
    .composer-status.success,
    .doc-meta-status.success { color: var(--success); }
    .layout { display:grid; grid-template-columns:360px 1fr; gap:20px; }
    .panel {
      background:rgba(23,26,33,0.9);
      border:1px solid var(--line);
      border-radius:24px;
      overflow:hidden;
      backdrop-filter:blur(10px);
      min-height:70vh;
    }
    .list { padding:12px; }
    .card {
      display:grid;
      grid-template-columns:96px 1fr;
      gap:14px;
      padding:12px;
      border-radius:18px;
      cursor:pointer;
      transition:160ms ease;
      border:1px solid transparent;
    }
    .card:hover, .card.active {
      background:rgba(255,255,255,0.03);
      border-color:var(--line);
    }
    .card img {
      width:96px;
      height:96px;
      object-fit:cover;
      border-radius:14px;
      background:#0b0d11;
    }
    .card .eyebrow {
      font-size:12px;
      color:var(--brand);
      margin-bottom:6px;
      text-transform:uppercase;
      letter-spacing:0.08em;
    }
    .card .title {
      font-size:16px;
      font-weight:700;
      line-height:1.3;
      margin-bottom:8px;
    }
    .card .desc {
      font-size:13px;
      line-height:1.45;
      color:var(--muted);
      display:-webkit-box;
      -webkit-line-clamp:3;
      -webkit-box-orient:vertical;
      overflow:hidden;
    }
    .detail { padding:28px; }
    .detail-header {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      margin-bottom:12px;
      flex-wrap:wrap;
    }
    .detail-kicker {
      display:flex;
      gap:10px;
      align-items:center;
      color:var(--muted);
      font-size:13px;
      flex-wrap:wrap;
      text-transform:uppercase;
      letter-spacing:0.08em;
    }
    .status-chip {
      display:inline-flex;
      align-items:center;
      padding:4px 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,0.08);
      background:rgba(255,255,255,0.04);
      color:#dbe3ef;
      font-size:11px;
      font-weight:700;
      letter-spacing:0.08em;
    }
    .status-chip.is-draft {
      border-color:rgba(255, 196, 104, 0.28);
      background:rgba(255, 196, 104, 0.12);
      color:#ffd998;
    }
    .status-chip.is-published {
      border-color:rgba(142,246,60,0.24);
      background:rgba(142,246,60,0.12);
      color:var(--brand);
    }
    .detail-actions {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .detail-action,
    .detail-link {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:42px;
      padding:0 14px;
      border-radius:999px;
      border:1px solid var(--line);
      background:rgba(255,255,255,0.03);
      color:var(--text);
      font:inherit;
      text-decoration:none;
      cursor:pointer;
    }
    .detail-action--primary {
      border-color:rgba(142,246,60,0.35);
      background:rgba(142,246,60,0.12);
      color:var(--brand);
      font-weight:700;
    }
    .detail-note {
      margin:0 0 18px;
      color:var(--muted);
      line-height:1.7;
      font-size:14px;
    }
    .meta {
      display:flex;
      gap:12px;
      align-items:center;
      color:var(--muted);
      margin-bottom:12px;
      font-size:14px;
      flex-wrap:wrap;
    }
    .detail h2 {
      margin:0 0 18px;
      font-size:clamp(28px,4vw,48px);
      line-height:1.02;
      letter-spacing:-0.03em;
    }
    .cover {
      width:100%;
      aspect-ratio:16 / 8;
      object-fit:cover;
      border-radius:20px;
      background:#0b0d11;
      margin-bottom:22px;
    }
    .author { display:flex; gap:12px; align-items:center; margin-bottom:24px; }
    .author img {
      width:44px;
      height:44px;
      border-radius:50%;
      object-fit:cover;
      background:#0b0d11;
    }
    .content {
      color:#e7ebf3;
      font-size:17px;
      line-height:1.92;
      word-break:normal;
      overflow-wrap:anywhere;
      font-family:"Iowan Old Style", "Palatino Linotype", "PingFang SC", "Noto Serif SC", "Songti SC", serif;
      font-kerning:normal;
      line-break:loose;
      text-wrap:pretty;
    }
    .content > *:first-child { margin-top:0 !important; }
    .content > *:last-child { margin-bottom:0 !important; }
    .content p {
      margin:0 0 18px;
      color:#dbe3ef;
      text-align:left;
    }
    .content h1,
    .content h2,
    .content h3 {
      margin:34px 0 14px;
      line-height:1.2;
      letter-spacing:-0.02em;
      color:#f4f7fb;
      font-family:"Avenir Next", "SF Pro Display", "PingFang SC", "Noto Sans SC", sans-serif;
      text-wrap:balance;
    }
    .content h1 {
      font-size:clamp(31px, 3vw, 38px);
      font-weight:800;
    }
    .content h2 {
      font-size:clamp(24px, 2.2vw, 30px);
      font-weight:700;
    }
    .content h3 {
      font-size:clamp(19px, 1.8vw, 22px);
      font-weight:700;
    }
    .content h1 + p,
    .content h2 + p,
    .content h3 + p {
      color:#c9d3e1;
    }
    .content ul,
    .content ol {
      margin:0 0 24px 1.35em;
      padding:0;
    }
    .content li {
      margin:0 0 12px;
      color:#dbe3ef;
      padding-left:2px;
    }
    .content blockquote {
      margin:0 0 22px;
      padding:14px 18px;
      border-left:3px solid rgba(142,246,60,0.6);
      color:#c8d3e3;
      background:rgba(255,255,255,0.03);
      border-radius:12px;
    }
    .content hr {
      border:0;
      border-top:1px solid rgba(255,255,255,0.08);
      margin:28px 0;
    }
    .content strong,
    .content b {
      color:#f4f7fb;
      font-weight:700;
    }
    .content em,
    .content i {
      color:#eef3fb;
      font-style:italic;
    }
    .content code {
      font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:8px;
      padding:2px 6px;
      font-size:0.95em;
    }
    .content pre {
      margin:0 0 20px;
      padding:14px 16px;
      overflow:auto;
      border-radius:16px;
      background:#0c0f15;
      border:1px solid rgba(255,255,255,0.08);
    }
    .content a {
      color:#b9ff78;
      text-decoration:underline;
      text-decoration-thickness:1.5px;
      text-underline-offset:0.18em;
      word-break:break-all;
    }
    .content a:hover {
      color:#d6ffae;
    }
    .content .feishu-inline-image {
      display:block;
      width:auto;
      max-width:min(100%, 520px);
      max-height:420px;
      height:auto;
      margin:20px auto;
      border-radius:16px;
      border:1px solid rgba(255,255,255,0.08);
      background:#0b0d11;
      object-fit:contain;
      box-shadow:0 10px 30px rgba(0,0,0,0.18);
    }
    .content .feishu-callout {
      margin:0 0 22px !important;
      border-radius:18px !important;
      backdrop-filter:blur(6px);
    }
    .content .feishu-mention {
      display:inline-flex;
      align-items:center;
      padding:0.08em 0.5em;
      margin:0 0.18em 0 0;
      border-radius:999px;
      background:rgba(142,246,60,0.12);
      color:#d6ffae;
      font-family:"Avenir Next", "SF Pro Text", "PingFang SC", "Noto Sans SC", sans-serif;
      font-size:0.92em;
      white-space:nowrap;
    }
    .content .feishu-file-card {
      margin:18px 0 22px;
      padding:16px 18px;
      border-radius:18px;
      border:1px solid rgba(255,255,255,0.08);
      background:rgba(255,255,255,0.03);
    }
    .content .feishu-file-card__title {
      font-size:15px;
      font-weight:700;
      color:#f4f7fb;
      margin-bottom:6px;
    }
    .content .feishu-file-card__meta {
      font-size:13px;
      color:#98a2b3;
      margin-bottom:10px;
    }
    .content .feishu-file-card__link {
      display:inline-flex;
      align-items:center;
      border:1px solid rgba(142,246,60,0.35);
      background:rgba(142,246,60,0.1);
      color:#8ef63c;
      padding:8px 12px;
      border-radius:999px;
      font-weight:600;
    }
    .content table {
      width:100%;
      border-collapse:collapse;
      margin:0 0 24px;
      overflow:hidden;
      border-radius:18px;
      border:1px solid rgba(255,255,255,0.08);
      background:rgba(255,255,255,0.03);
    }
    .content th,
    .content td {
      padding:12px 14px;
      border-bottom:1px solid rgba(255,255,255,0.06);
      text-align:left;
      vertical-align:top;
    }
    .content th {
      color:#f4f7fb;
      font-family:"Avenir Next", "SF Pro Display", "PingFang SC", "Noto Sans SC", sans-serif;
      font-size:13px;
      text-transform:uppercase;
      letter-spacing:0.06em;
      background:rgba(255,255,255,0.04);
    }
    .status { color:var(--muted); padding:36px; line-height:1.7; }
    @media (max-width: 960px) {
      .layout { grid-template-columns:1fr; }
      .panel { min-height:unset; }
      .composer-grid { grid-template-columns:1fr; }
      .hero { flex-direction:column; align-items:flex-start; }
      .input-row { flex-direction:column; }
      .detail-header { flex-direction:column; }
      .detail-actions { justify-content:flex-start; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="hero">
      <div><h1>Feishu <span>Blog CMS</span><br />Preview</h1></div>
      <p>这版按照飞书官方那篇“云文档做 CMS”的思路重新收紧了体验：正文以飞书文档为主，CMS 只负责元数据、草稿与发布。最顺手的添加方式应该是“先写文档，再贴链接”，而不是手填整张数据表。</p>
    </div>
    <div class="toolbar" id="type-toolbar">
      <button data-type="all" class="active">All posts</button>
      <button data-type="0">Developer</button>
      <button data-type="1">Employer</button>
    </div>
    <div class="toolbar" id="status-toolbar">
      <button data-status="published" class="active">Published</button>
      <button data-status="draft">Drafts</button>
      <button data-status="all">All status</button>
    </div>
    <details class="composer" id="composer">
      <summary><span id="composer-heading">新增文章</span><span class="composer-mode-badge" id="composer-mode-badge">Create</span></summary>
      <div class="composer-intro" id="composer-intro">最省事的方式已经变成：先在飞书写正文，然后把 wiki 或 docx 链接贴过来，直接点“一键创建草稿”。如果你想微调标题、摘要或 slug，再往下改高级字段就行。</div>
      <form id="composer-form">
        <div class="composer-grid">
          <div class="field field-wide">
            <label for="docUrl">飞书文档链接</label>
            <div class="input-row">
              <input id="docUrl" name="docUrl" placeholder="粘贴 wiki 或 docx 链接" required />
              <button type="button" class="ghost-button primary-ghost" id="quick-create">一键创建草稿</button>
              <button type="button" class="ghost-button" id="doc-meta-fetch">读取文档信息</button>
            </div>
            <div class="doc-meta-status" id="doc-meta-status">只想快速新增一篇时，最少只需要这一步。系统会在后台自动尝试提取标题、副标题和 shortUrl。</div>
          </div>
          <div class="field">
            <label for="title">标题</label>
            <input id="title" name="title" placeholder="可留空，系统会尝试从文档里读取" />
          </div>
          <div class="field">
            <label for="type">分类</label>
            <select id="type" name="type">
              <option value="0">Developer</option>
              <option value="1">Employer</option>
            </select>
          </div>
          <div class="field">
            <label for="shortUrl">shortUrl / slug</label>
            <input id="shortUrl" name="shortUrl" placeholder="留空自动生成" />
            <div class="hint">支持中文和英文。你可以手动改；如果不改，系统会按标题自动生成更自然的链接。</div>
          </div>
          <div class="field">
            <label for="status">发布状态</label>
            <select id="status" name="status">
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
            <div class="hint">更像正式 CMS 的做法是先存 draft，确认排版和权限后再切到 published。</div>
          </div>
          <div class="field field-wide">
            <label for="subTitle">副标题</label>
            <textarea id="subTitle" name="subTitle" placeholder="可留空，系统会尝试抓取正文里第一段有代表性的内容"></textarea>
          </div>
          <div class="field">
            <label for="blogCoverUrl">封面图 URL</label>
            <input id="blogCoverUrl" name="blogCoverUrl" placeholder="可选，公开图片链接" />
          </div>
          <div class="field">
            <label for="authorName">作者名</label>
            <input id="authorName" name="authorName" placeholder="可选，例如 Kevin Shi" />
          </div>
        </div>
        <div class="composer-actions">
          <button type="submit" id="composer-submit">创建文章</button>
          <button type="button" class="ghost-button" id="composer-publish">创建并发布</button>
          <button type="button" class="ghost-button is-hidden" id="composer-cancel">取消编辑</button>
          <div class="composer-status" id="composer-status">默认推荐先保存成 draft。创建后我会自动切到对应的状态列表，让你立刻看到它。</div>
        </div>
      </form>
    </details>
    <div class="layout">
      <div class="panel list" id="list"></div>
      <div class="panel detail" id="detail"><div class="status">Loading preview…</div></div>
    </div>
  </div>
  <script>
    const listEl = document.getElementById("list");
    const detailEl = document.getElementById("detail");
    const typeButtons = Array.from(document.querySelectorAll("[data-type]"));
    const statusButtons = Array.from(document.querySelectorAll("[data-status]"));
    const composerForm = document.getElementById("composer-form");
    const composerStatusEl = document.getElementById("composer-status");
    const composerSubmitEl = document.getElementById("composer-submit");
    const composerPublishEl = document.getElementById("composer-publish");
    const composerCancelEl = document.getElementById("composer-cancel");
    const composerEl = document.getElementById("composer");
    const composerHeadingEl = document.getElementById("composer-heading");
    const composerModeBadgeEl = document.getElementById("composer-mode-badge");
    const composerIntroEl = document.getElementById("composer-intro");
    const docMetaFetchEl = document.getElementById("doc-meta-fetch");
    const quickCreateEl = document.getElementById("quick-create");
    const docMetaStatusEl = document.getElementById("doc-meta-status");
    const titleInput = document.getElementById("title");
    const subTitleInput = document.getElementById("subTitle");
    const shortUrlInput = document.getElementById("shortUrl");
    const docUrlInput = document.getElementById("docUrl");
    const pageQuery = new URLSearchParams(window.location.search);
    let currentType = "all";
    let currentStatus = "published";
    let currentPosts = [];
    let currentShortUrl = "";
    let currentPostData = null;
    let editorMode = "create";
    let editingRecordId = "";

    function fmtDate(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }

    function typeLabel(value) {
      return value === "1" ? "Employer" : "Developer";
    }

    function statusLabel(value) {
      return value === "draft" ? "Draft" : "Published";
    }

    function setComposerStatus(message, kind) {
      composerStatusEl.textContent = message;
      composerStatusEl.className = "composer-status" + (kind ? " " + kind : "");
    }

    function setDocMetaStatus(message, kind) {
      docMetaStatusEl.textContent = message;
      docMetaStatusEl.className = "doc-meta-status" + (kind ? " " + kind : "");
    }

    function suggestShortUrl(value) {
      return String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/['’"]/g, "")
        .replace(/[^\\p{L}\\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
    }

    function resetComposerFields() {
      composerForm.reset();
      shortUrlInput.dataset.manual = "";
      composerForm.status.value = "draft";
    }

    function enterCreateMode() {
      editorMode = "create";
      editingRecordId = "";
      composerHeadingEl.textContent = "新增文章";
      composerModeBadgeEl.textContent = "Create";
      composerIntroEl.textContent = "最省事的方式已经变成：先在飞书写正文，然后把 wiki 或 docx 链接贴过来，直接点“一键创建草稿”。如果你想微调标题、摘要或 slug，再往下改高级字段就行。";
      composerSubmitEl.textContent = "创建文章";
      composerPublishEl.textContent = "创建并发布";
      composerCancelEl.classList.add("is-hidden");
      quickCreateEl.classList.remove("is-hidden");
    }

    function fillComposerFromPost(post) {
      composerForm.title.value = post.title || "";
      composerForm.type.value = post.type || "0";
      composerForm.docUrl.value = post.docUrl || "";
      composerForm.shortUrl.value = post.shortUrl || "";
      composerForm.status.value = post.status || "draft";
      composerForm.subTitle.value = post.subTitle || "";
      composerForm.blogCoverUrl.value = post.blogCoverUrl || "";
      composerForm.authorName.value = post.authorName || ((post.authorList || [])[0] || {}).name || "";
      shortUrlInput.dataset.manual = composerForm.shortUrl.value.trim() ? "1" : "";
    }

    function enterEditMode(post) {
      if (!post) {
        return;
      }

      editorMode = "edit";
      editingRecordId = post.recordId || "";
      fillComposerFromPost(post);
      composerHeadingEl.textContent = "编辑文章";
      composerModeBadgeEl.textContent = "Edit";
      composerIntroEl.textContent = "正文内容继续在飞书文档里修改；这里负责标题、slug、封面、作者和发布状态。你改完保存后，右侧预览会立即按统一样式刷新。";
      composerSubmitEl.textContent = post.status === "draft" ? "保存草稿" : "保存修改";
      composerPublishEl.textContent = "保存并发布";
      composerCancelEl.classList.remove("is-hidden");
      quickCreateEl.classList.add("is-hidden");
      composerEl.open = true;
      setDocMetaStatus("如果你换了飞书文档链接，可以再点一次“读取文档信息”同步标题和摘要。", "");
      setComposerStatus("现在是编辑模式。正文建议直接在飞书文档里改，这里改的是元数据和发布状态。", "");
    }

    function restoreCreateMode(closePanel) {
      resetComposerFields();
      enterCreateMode();
      setDocMetaStatus("只想快速新增一篇时，最少只需要飞书文档链接这一步。系统会在后台自动尝试提取标题、副标题和 shortUrl。", "");
      if (closePanel) {
        composerEl.open = false;
      }
    }

    async function applyQueryPrefill() {
      const docUrl = (pageQuery.get("docUrl") || "").trim();
      const title = (pageQuery.get("title") || "").trim();
      const subTitle = (pageQuery.get("subTitle") || "").trim();
      const shortUrl = (pageQuery.get("shortUrl") || "").trim();
      const blogCoverUrl = (pageQuery.get("blogCoverUrl") || "").trim();
      const authorName = (pageQuery.get("authorName") || "").trim();
      const queryType = (pageQuery.get("type") || "").trim();
      const queryStatus = (pageQuery.get("status") || "").trim();
      const openComposer = pageQuery.get("openComposer") !== "0";
      const autoHydrate = pageQuery.get("autoHydrate") !== "0";

      if (queryType === "0" || queryType === "1") {
        composerForm.type.value = queryType;
        currentType = queryType;
      }

      if (queryStatus === "draft" || queryStatus === "published" || queryStatus === "all") {
        composerForm.status.value = queryStatus === "all" ? "draft" : queryStatus;
        currentStatus = queryStatus;
      }

      if (!docUrl && !title && !subTitle && !shortUrl && !blogCoverUrl && !authorName) {
        return;
      }

      if (docUrl) {
        docUrlInput.value = docUrl;
      }
      if (title) {
        titleInput.value = title;
      }
      if (subTitle) {
        subTitleInput.value = subTitle;
      }
      if (shortUrl) {
        shortUrlInput.value = shortUrl;
        shortUrlInput.dataset.manual = "1";
      }
      if (blogCoverUrl) {
        composerForm.blogCoverUrl.value = blogCoverUrl;
      }
      if (authorName) {
        composerForm.authorName.value = authorName;
      }

      if (openComposer) {
        composerEl.open = true;
      }

      setComposerStatus("我已经把公开站带过来的预填信息放进表单里了。确认一下后，你可以直接一键创建草稿或发布。", "");

      if (docUrl && autoHydrate) {
        setDocMetaStatus("已带入飞书文档链接，正在自动读取标题和摘要…", "");
        await hydrateFromDoc(openComposer);
        return;
      }

      if (docUrl) {
        setDocMetaStatus("已带入飞书文档链接。你也可以手动点一次“读取文档信息”同步标题和摘要。", "");
      }
    }

    titleInput.addEventListener("input", function () {
      if (!shortUrlInput.dataset.manual || !shortUrlInput.value.trim()) {
        shortUrlInput.value = suggestShortUrl(titleInput.value);
      }
    });

    shortUrlInput.addEventListener("input", function () {
      shortUrlInput.dataset.manual = shortUrlInput.value.trim() ? "1" : "";
    });

    async function fetchPosts(type, status) {
      const filter = [];
      if (type !== "all") {
        filter.push({ fieldName: "type", fieldValue: type });
      }
      if (status !== "all") {
        filter.push({ fieldName: "status", fieldValue: status });
      }

      const response = await fetch("/blogs/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber: 1, pageSize: 100, filter: filter })
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.msg || "加载文章列表失败");
      }
      return payload.data || [];
    }

    async function fetchPost(shortUrl, includeDraft) {
      const query = new URLSearchParams({ shortUrl: shortUrl });
      if (includeDraft) {
        query.set("includeDraft", "1");
      }
      const response = await fetch("/blogs?" + query.toString());
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.msg || "加载文章详情失败");
      }
      return payload.data;
    }

    async function fetchDocMeta(docUrl) {
      const response = await fetch("/cms/doc-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docUrl: docUrl })
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.msg || "读取文档信息失败");
      }
      return payload.data;
    }

    async function createArticle(payload) {
      const response = await fetch("/cms/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || data.code !== 0) {
        throw new Error(data.msg || "创建失败");
      }
      return data.data;
    }

    async function updateArticle(payload) {
      const response = await fetch("/cms/articles/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || data.code !== 0) {
        throw new Error(data.msg || "更新失败");
      }
      return data.data;
    }

    function buildArticlePayload(overrides, sourcePost, useSourceDefaults) {
      const base = {
        title: composerForm.title.value,
        type: composerForm.type.value,
        docUrl: composerForm.docUrl.value,
        shortUrl: composerForm.shortUrl.value,
        status: composerForm.status.value,
        subTitle: composerForm.subTitle.value,
        blogCoverUrl: composerForm.blogCoverUrl.value,
        authorName: composerForm.authorName.value
      };

      if (useSourceDefaults && sourcePost) {
        if (!base.title) base.title = sourcePost.title || "";
        if (!base.type) base.type = sourcePost.type || "0";
        if (!base.docUrl) base.docUrl = sourcePost.docUrl || "";
        if (!base.shortUrl) base.shortUrl = sourcePost.shortUrl || "";
        if (!base.status) base.status = sourcePost.status || "draft";
        if (!base.subTitle) base.subTitle = sourcePost.subTitle || "";
        if (!base.blogCoverUrl) base.blogCoverUrl = sourcePost.blogCoverUrl || "";
        if (!base.authorName) base.authorName = sourcePost.authorName || ((sourcePost.authorList || [])[0] || {}).name || "";
      }

      return Object.assign(base, overrides || {});
    }

    async function focusCreatedArticle(created, message) {
      restoreCreateMode(true);
      await reload(currentType, currentStatus === "all" ? "all" : (created.status || "published"));
      await selectPost(created.shortUrl);
      setComposerStatus(message || ("文章已创建： " + created.shortUrl), "success");
    }

    async function focusUpdatedArticle(updated, message, reopenEditor) {
      await reload(currentType, currentStatus === "all" ? "all" : (updated.status || currentStatus));
      await selectPost(updated.shortUrl);
      if (reopenEditor && currentPostData) {
        enterEditMode(currentPostData);
      }
      setComposerStatus(message || ("文章已更新： " + updated.shortUrl), "success");
    }

    function renderList() {
      if (!currentPosts.length) {
        listEl.innerHTML = '<div class="status">这个筛选条件下还没有文章。你可以先新增一篇，或者切换上面的状态和分类看看。</div>';
        return;
      }
      listEl.innerHTML = currentPosts.map(function (item) {
        const active = item.shortUrl === currentShortUrl ? "active" : "";
        const eyebrow = typeLabel(item.type) + " · " + statusLabel(item.status || "published");
        return '<div class="card ' + active + '" data-short-url="' + (item.shortUrl || "") + '">' +
          '<img src="' + (item.blogCoverUrl || "") + '" alt="">' +
          '<div><div class="eyebrow">' + eyebrow + '</div>' +
          '<div class="title">' + (item.title || "") + '</div>' +
          '<div class="desc">' + (item.subTitle || "") + '</div></div></div>';
      }).join("");
      listEl.querySelectorAll("[data-short-url]").forEach(function (node) {
        node.addEventListener("click", function () {
          selectPost(node.dataset.shortUrl);
        });
      });
    }

    function renderDetail(post) {
      if (!post) {
        currentPostData = null;
        detailEl.innerHTML = '<div class="status">Select a post to preview.</div>';
        return;
      }
      const author = (post.authorList || [])[0] || {};
      const statusClass = post.status === "draft" ? "is-draft" : "is-published";
      const docLink = post.docUrl
        ? '<a class="detail-link" href="' + post.docUrl + '" target="_blank" rel="noopener noreferrer">打开飞书文档</a>'
        : "";
      const saveDraftLabel = post.status === "draft" ? "保持草稿" : "转为草稿";
      const publishLabel = post.status === "published" ? "重新发布" : "发布文章";

      detailEl.innerHTML =
        '<div class="detail-header">' +
          '<div class="detail-kicker">' +
            '<span>' + typeLabel(post.type) + '</span>' +
            '<span class="status-chip ' + statusClass + '">' + statusLabel(post.status) + '</span>' +
            '<span>Slug · ' + (post.shortUrl || "") + '</span>' +
          '</div>' +
          '<div class="detail-actions">' +
            '<button class="detail-action" data-detail-action="edit">编辑元数据</button>' +
            '<button class="detail-action" data-detail-action="draft">' + saveDraftLabel + '</button>' +
            '<button class="detail-action detail-action--primary" data-detail-action="publish">' + publishLabel + '</button>' +
            docLink +
          '</div>' +
        '</div>' +
        '<div class="meta"><span>Updated ' + fmtDate(post.updatedAt || post.updateDate) + '</span><span>•</span><span>' + (post.authorName || author.name || "Unknown author") + '</span><span>•</span><span>' + statusLabel(post.status) + '</span></div>' +
        '<h2>' + (post.title || "") + '</h2>' +
        '<p class="detail-note">正文内容建议直接在飞书文档里修改；右侧预览会按统一的博客排版规则自动标准化，包括标题层级、链接、中文英文混排和图片样式。</p>' +
        (post.blogCoverUrl ? '<img class="cover" src="' + post.blogCoverUrl + '" alt="">' : '') +
        '<div class="author">' +
          (author.profilePic ? '<img src="' + author.profilePic + '" alt="">' : '') +
          '<div><div style="font-size:12px;color:#98a2b3;">Written by</div><div style="font-weight:700;">' + (author.name || post.authorName || "Unknown author") + '</div></div>' +
        '</div>' +
        '<div class="content">' + (post.content || "") + '</div>';
    }

    async function selectPost(shortUrl) {
      currentShortUrl = shortUrl;
      renderList();
      detailEl.innerHTML = '<div class="status">Loading article…</div>';
      try {
        const post = await fetchPost(shortUrl, currentStatus !== "published");
        currentPostData = post;
        renderDetail(post);
      } catch (error) {
        currentPostData = null;
        detailEl.innerHTML = '<div class="status">' + (error.message || "加载文章失败") + '</div>';
      }
    }

    async function reload(type, status) {
      currentType = type;
      currentStatus = status;
      typeButtons.forEach(function (button) {
        button.classList.toggle("active", button.dataset.type === currentType);
      });
      statusButtons.forEach(function (button) {
        button.classList.toggle("active", button.dataset.status === currentStatus);
      });
      listEl.innerHTML = '<div class="status">Loading posts…</div>';

      try {
        const previousShortUrl = currentShortUrl;
        currentPosts = await fetchPosts(type, status);
        currentShortUrl = (currentPosts.find(function (item) {
          return item.shortUrl === previousShortUrl;
        }) || currentPosts[0] || {}).shortUrl || "";
        renderList();
        if (currentShortUrl) {
          await selectPost(currentShortUrl);
        } else {
          renderDetail(null);
        }
      } catch (error) {
        currentPosts = [];
        listEl.innerHTML = '<div class="status">' + (error.message || "加载文章列表失败") + '</div>';
        renderDetail(null);
      }
    }

    async function hydrateFromDoc(autoOpenComposer) {
      const docUrl = docUrlInput.value.trim();
      if (!docUrl) {
        setDocMetaStatus("请先粘贴飞书文档链接。", "error");
        return;
      }

      docMetaFetchEl.disabled = true;
      setDocMetaStatus("正在读取文档信息…", "");

      try {
        const meta = await fetchDocMeta(docUrl);
        if (!titleInput.value.trim()) {
          titleInput.value = meta.title || "";
        }
        if (!subTitleInput.value.trim()) {
          subTitleInput.value = meta.subTitle || "";
        }
        if (!shortUrlInput.dataset.manual || !shortUrlInput.value.trim()) {
          shortUrlInput.value = meta.shortUrl || suggestShortUrl(titleInput.value);
        }
        if (autoOpenComposer) {
          composerEl.open = true;
        }
        setDocMetaStatus("已从 " + (meta.sourceType || "doc") + " 文档里读取推荐标题和摘要。", "success");
      } catch (error) {
        setDocMetaStatus(error.message || "读取文档信息失败。", "error");
      } finally {
        docMetaFetchEl.disabled = false;
      }
    }

    async function saveThroughComposer(overrides, successMessage) {
      const isEdit = editorMode === "edit" && editingRecordId;
      const payload = buildArticlePayload(overrides, currentPostData, false);

      composerSubmitEl.disabled = true;
      composerPublishEl.disabled = true;
      quickCreateEl.disabled = true;
      setComposerStatus(isEdit ? "正在保存文章更新…" : "正在创建文章记录…", "");

      try {
        if (isEdit) {
          payload.recordId = editingRecordId;
          const updated = await updateArticle(payload);
          await focusUpdatedArticle(updated, successMessage || ("文章已更新： " + updated.shortUrl), true);
        } else {
          const created = await createArticle(payload);
          await focusCreatedArticle(created, successMessage || ("文章已创建： " + created.shortUrl));
        }
      } catch (error) {
        setComposerStatus(error.message || (isEdit ? "更新失败，请稍后重试。" : "创建失败，请稍后重试。"), "error");
      } finally {
        composerSubmitEl.disabled = false;
        composerPublishEl.disabled = false;
        quickCreateEl.disabled = false;
      }
    }

    async function updateFromDetail(status, message) {
      if (!currentPostData || !currentPostData.recordId) {
        return;
      }

      const payload = {
        recordId: currentPostData.recordId,
        title: currentPostData.title || "",
        type: currentPostData.type || "0",
        docUrl: currentPostData.docUrl || "",
        shortUrl: currentPostData.shortUrl || "",
        status: status,
        subTitle: currentPostData.subTitle || "",
        blogCoverUrl: currentPostData.blogCoverUrl || "",
        authorName: currentPostData.authorName || ((currentPostData.authorList || [])[0] || {}).name || ""
      };

      setComposerStatus("正在更新发布状态…", "");

      try {
        const updated = await updateArticle(payload);
        await focusUpdatedArticle(updated, message, editorMode === "edit" && editingRecordId === currentPostData.recordId);
      } catch (error) {
        setComposerStatus(error.message || "更新失败，请稍后重试。", "error");
      }
    }

    typeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        reload(button.dataset.type, currentStatus);
      });
    });

    statusButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        reload(currentType, button.dataset.status);
      });
    });

    docMetaFetchEl.addEventListener("click", function () {
      hydrateFromDoc(true);
    });

    quickCreateEl.addEventListener("click", function () {
      if (!docUrlInput.value.trim()) {
        setDocMetaStatus("请先粘贴飞书文档链接。", "error");
        return;
      }

      saveThroughComposer(
        {
          title: composerForm.title.value,
          subTitle: composerForm.subTitle.value,
          shortUrl: composerForm.shortUrl.value,
          status: "draft"
        },
        "草稿已一键创建。我已经自动切到 Drafts，并在右侧打开它。",
      );
    });

    composerPublishEl.addEventListener("click", function () {
      saveThroughComposer(
        { status: "published" },
        editorMode === "edit" ? "文章已保存并发布。" : "文章已创建并发布。",
      );
    });

    composerCancelEl.addEventListener("click", function () {
      restoreCreateMode(true);
      setComposerStatus("已经退出编辑模式。你可以继续新增文章，或者从右侧文章里重新点“编辑元数据”。", "");
    });

    detailEl.addEventListener("click", function (event) {
      const actionNode = event.target.closest("[data-detail-action]");
      if (!actionNode || !currentPostData) {
        return;
      }

      const action = actionNode.dataset.detailAction;
      if (action === "edit") {
        enterEditMode(currentPostData);
        return;
      }

      if (action === "draft") {
        updateFromDetail("draft", "文章已保存到草稿箱。");
        return;
      }

      if (action === "publish") {
        updateFromDetail("published", "文章已发布。");
      }
    });

    docUrlInput.addEventListener("change", function () {
      if (docUrlInput.value.trim()) {
        hydrateFromDoc(false);
      }
    });

    composerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveThroughComposer({}, editorMode === "edit" ? "文章已保存。" : "文章已创建。");
    });

    restoreCreateMode(false);
    Promise.resolve(applyQueryPrefill()).finally(function () {
      reload(currentType, currentStatus);
    });
  </script>
</body>
</html>`;

module.exports = function previewPage(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
};
