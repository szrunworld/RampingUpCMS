"use strict";

const html = `<!DOCTYPE html>
<html lang="en">
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
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(142,246,60,0.12), transparent 30%),
        linear-gradient(180deg, #0f1115 0%, #12151d 100%);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell { width: min(1200px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0 64px; }
    .hero { display:flex; justify-content:space-between; gap:24px; align-items:end; margin-bottom:28px; }
    .hero h1 { margin:0; font-size:clamp(36px,5vw,64px); line-height:0.95; letter-spacing:-0.03em; }
    .hero h1 span { color: var(--brand); }
    .hero p { margin:0; max-width:480px; color:var(--muted); line-height:1.6; }
    .toolbar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
    .toolbar button { border:1px solid var(--line); background:rgba(255,255,255,0.02); color:var(--text); border-radius:999px; padding:10px 14px; cursor:pointer; }
    .toolbar button.active { background:var(--brand); color:#0d0f13; border-color:var(--brand); font-weight:700; }
    .layout { display:grid; grid-template-columns:360px 1fr; gap:20px; }
    .panel { background:rgba(23,26,33,0.9); border:1px solid var(--line); border-radius:24px; overflow:hidden; backdrop-filter:blur(10px); min-height:70vh; }
    .list { padding:12px; }
    .card { display:grid; grid-template-columns:96px 1fr; gap:14px; padding:12px; border-radius:18px; cursor:pointer; transition:160ms ease; border:1px solid transparent; }
    .card:hover, .card.active { background:rgba(255,255,255,0.03); border-color:var(--line); }
    .card img { width:96px; height:96px; object-fit:cover; border-radius:14px; background:#0b0d11; }
    .card .eyebrow { font-size:12px; color:var(--brand); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.08em; }
    .card .title { font-size:16px; font-weight:700; line-height:1.3; margin-bottom:8px; }
    .card .desc { font-size:13px; line-height:1.45; color:var(--muted); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .detail { padding:28px; }
    .meta { display:flex; gap:12px; align-items:center; color:var(--muted); margin-bottom:12px; font-size:14px; }
    .detail h2 { margin:0 0 18px; font-size:clamp(28px,4vw,48px); line-height:1.02; letter-spacing:-0.03em; }
    .cover { width:100%; aspect-ratio:16 / 8; object-fit:cover; border-radius:20px; background:#0b0d11; margin-bottom:22px; }
    .author { display:flex; gap:12px; align-items:center; margin-bottom:24px; }
    .author img { width:44px; height:44px; border-radius:50%; object-fit:cover; background:#0b0d11; }
    .content { color:#e7ebf3; font-size:16px; line-height:1.8; }
    .content p { margin:0 0 16px; }
    .status { color:var(--muted); padding:36px; }
    @media (max-width: 960px) { .layout { grid-template-columns:1fr; } .panel { min-height:unset; } }
  </style>
</head>
<body>
  <div class="shell">
    <div class="hero">
      <div><h1>Feishu <span>Blog CMS</span><br />Preview</h1></div>
      <p>This preview keeps the current blog API shape, but swaps the content source to a Feishu-ready adapter.</p>
    </div>
    <div class="toolbar">
      <button data-type="all" class="active">All posts</button>
      <button data-type="0">Developer</button>
      <button data-type="1">Employer</button>
    </div>
    <div class="layout">
      <div class="panel list" id="list"></div>
      <div class="panel detail" id="detail"><div class="status">Loading preview…</div></div>
    </div>
  </div>
  <script>
    const listEl = document.getElementById("list");
    const detailEl = document.getElementById("detail");
    const toolbarButtons = Array.from(document.querySelectorAll("[data-type]"));
    let currentType = "all";
    let currentPosts = [];
    let currentShortUrl = "";

    function fmtDate(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }

    async function fetchPosts(type) {
      const filter = type === "all" ? [] : [{ fieldName: "type", fieldValue: type }];
      const response = await fetch("/blogs/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber: 1, pageSize: 100, filter })
      });
      const payload = await response.json();
      return payload.data || [];
    }

    async function fetchPost(shortUrl) {
      const response = await fetch("/blogs?shortUrl=" + encodeURIComponent(shortUrl));
      const payload = await response.json();
      return payload.data;
    }

    function renderList() {
      if (!currentPosts.length) {
        listEl.innerHTML = '<div class="status">No posts found for this segment.</div>';
        return;
      }
      listEl.innerHTML = currentPosts.map((item) => {
        const active = item.shortUrl === currentShortUrl ? "active" : "";
        const eyebrow = item.type === "1" ? "Employer" : "Developer";
        return '<div class="card ' + active + '" data-short-url="' + item.shortUrl + '">' +
          '<img src="' + (item.blogCoverUrl || "") + '" alt="">' +
          '<div><div class="eyebrow">' + eyebrow + '</div>' +
          '<div class="title">' + (item.title || "") + '</div>' +
          '<div class="desc">' + (item.subTitle || "") + '</div></div></div>';
      }).join("");
      listEl.querySelectorAll("[data-short-url]").forEach((node) => {
        node.addEventListener("click", () => selectPost(node.dataset.shortUrl));
      });
    }

    function renderDetail(post) {
      if (!post) {
        detailEl.innerHTML = '<div class="status">Select a post to preview.</div>';
        return;
      }
      const author = (post.authorList || [])[0] || {};
      detailEl.innerHTML =
        '<div class="meta"><span>' + fmtDate(post.updateDate) + '</span><span>•</span><span>' + (post.shortUrl || "") + '</span></div>' +
        '<h2>' + (post.title || "") + '</h2>' +
        (post.blogCoverUrl ? '<img class="cover" src="' + post.blogCoverUrl + '" alt="">' : '') +
        '<div class="author">' +
          (author.profilePic ? '<img src="' + author.profilePic + '" alt="">' : '') +
          '<div><div style="font-size:12px;color:#98a2b3;">Written by</div><div style="font-weight:700;">' + (author.name || 'Unknown author') + '</div></div>' +
        '</div>' +
        '<div class="content">' + (post.content || "") + '</div>';
    }

    async function selectPost(shortUrl) {
      currentShortUrl = shortUrl;
      renderList();
      detailEl.innerHTML = '<div class="status">Loading article…</div>';
      const post = await fetchPost(shortUrl);
      renderDetail(post);
    }

    async function reload(type) {
      currentType = type;
      toolbarButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.type === type);
      });
      listEl.innerHTML = '<div class="status">Loading posts…</div>';
      currentPosts = await fetchPosts(type);
      currentShortUrl = currentPosts[0]?.shortUrl || "";
      renderList();
      if (currentShortUrl) {
        await selectPost(currentShortUrl);
      } else {
        renderDetail(null);
      }
    }

    toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => reload(button.dataset.type));
    });

    reload(currentType);
  </script>
</body>
</html>`;

module.exports = function previewPage(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
};
