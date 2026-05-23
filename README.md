# Feishu Blog CMS Demo

This demo shows the smallest practical way to put a Feishu-backed CMS behind the
existing Nuxt blog pages in `RampingUpWebsite`.

It is aligned to the current page contracts in:

- `pages/blogs/for-developer.vue`
- `pages/blogs/for-employer.vue`
- `pages/blogs/_id.vue`

Those pages already expect an API-driven blog source, so we do not need to
rewrite the blog frontend. We only need to swap the source behind:

- `POST /blogs/list`
- `GET /blogs?shortUrl=...`

## Recommended Feishu CMS shape

Use **Feishu Base** for metadata and **Feishu Docs** for article bodies.

### Base columns

Create one Base table with these columns:

- `title`
- `shortUrl`
- `subTitle`
- `type`
  - `0` for developer
  - `1` for employer
- `status`
  - `published` or `draft`
- `blogCoverUrl`
- `seoTitle`
- `seoDescription`
- `seoTag`
- `publishedAt`
- `updatedAt`
- `authorName`
- `authorAvatar`
- `authorListJson`
- `docUrl`
- `docToken`
- `publishedUrl`
- `contentHtml`

### Content strategy

This demo supports three content modes, in order:

1. `contentHtml`
   - best when you already have migrated HTML and want the smallest cutover
2. `docUrl`
   - best editor workflow for day-to-day use
   - can store a real Feishu `wiki` URL or `docx` URL directly
3. `publishedUrl`
   - good for a quick embed-based launch
4. `docToken`
   - fallback when you prefer storing the raw token instead of the full URL

For a real production blog, I would still recommend a second phase where we
upgrade `docUrl/docToken -> HTML` rendering from basic paragraph conversion to a richer
block renderer, because the current Nuxt detail page renders `content` via
`v-html`.

## Files

- `server/feishu-blog-cms.js`
  - Nuxt-compatible server middleware
- `server/standalone-server.mjs`
  - lets you run the adapter without changing the Nuxt project first
- `scripts/build-github-pages.mjs`
  - exports the published Feishu CMS content into a static `docs/` site for GitHub Pages
- `scripts/export-existing-blogs.mjs`
  - exports the current blog API content into JSON/CSV for Feishu migration
- `.env.example`
  - required environment variables

## How to run the adapter alone

```bash
cp .env.example .env
node server/standalone-server.mjs
```

The adapter exposes:

- `POST /blogs/list`
- `GET /blogs?shortUrl=...`

## How to publish this as GitHub Pages

GitHub Pages can only host static files, so the recommended setup is:

1. Keep the current local Feishu CMS preview for editing and publishing.
2. Export published content into `docs/`.
3. Let GitHub Pages deploy the `docs/` folder.

### Build the public site

Make sure the local preview server is already running and can read your Feishu
Base and Docs. Then run:

```bash
node scripts/build-github-pages.mjs
```

By default this:

- reads the CMS from `http://127.0.0.1:4310`
- writes the static site into `./docs`
- downloads Feishu images and attachments into `docs/assets/media`
- creates:
  - `docs/index.html`
  - `docs/posts/<shortUrl>/index.html`
  - `docs/assets/site.css`
  - `docs/404.html`
  - `docs/search-index.json`

### Deploy on GitHub

This repo includes:

- `.github/workflows/deploy-pages.yml`

The workflow deploys the committed `docs/` directory to GitHub Pages on pushes
to `main`.

### Important note about GitHub Pages availability

This repo is currently `szrunworld/RampingUpCMS`. The expected project site URL
is:

- `https://szrunworld.github.io/RampingUpCMS/`

Depending on your GitHub plan and current repository settings, you may still
need to enable GitHub Pages once in the repository settings and choose GitHub
Actions as the source.

GitHub's current documentation:

- What GitHub Pages supports:
  [What is GitHub Pages?](https://docs.github.com/pages/getting-started-with-github-pages/what-is-github-pages)
- Creating a site:
  [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## How to export the existing blogs

This is the migration helper for your current site content.

```bash
node scripts/export-existing-blogs.mjs \
  "https://your-current-blog-api.example.com" \
  "YOUR_API_CODE" \
  "./out"
```

It writes:

- `feishu-blog-import.json`
- `feishu-blog-import.csv`

These are shaped so you can import them into Feishu Base, then gradually move
each article body from `contentHtml` to real Feishu docs or wiki/docx URLs.

## How to wire this into the current Nuxt site

Because the current project directory is outside this writable workspace, I did
not edit it in place. The change you would make there is small:

1. Add the middleware file into the Nuxt project, for example:
   - `server-middleware/feishu-blog-cms.js`
2. Register it in `nuxt.config.js`
3. Point the existing blog pages at that middleware path

### Example `nuxt.config.js` shape

```js
serverMiddleware: [
  {
    path: "/api/feishu-cms",
    handler: "~/server-middleware/feishu-blog-cms.js"
  },
  {
    path: "/api",
    handler: createProxyMiddleware({
      target: "https://rampingupapi.azurewebsites.net/api/",
      changeOrigin: true
    })
  }
]
```

### Minimal frontend swap

In the blog pages, change:

- list source from `API_BASE_URL + '/blogs/list'`
- detail source from `API_BASE_URL + '/blogs'`

to:

- `/api/feishu-cms/blogs/list`
- `/api/feishu-cms/blogs`

That keeps the current page rendering almost unchanged.

## Why this is the right first step

- It keeps your current Nuxt pages.
- It gives editors a Feishu-native workflow.
- It lets you migrate existing content in stages instead of all at once.
- It avoids exposing Feishu secrets to the browser.

## Known limitations of this demo

- `docUrl` and `docToken` currently render a simplified HTML conversion, not a full rich block renderer.
- `blogCoverUrl` is best stored as a public URL field, not a Feishu attachment, for the first version.
- Feishu Base field names must either match the defaults or be overridden with env vars.

## Official Feishu API references

- Tenant access token:
  [自建应用获取 tenant_access_token](https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal?lang=zh-CN)
- Bitable records:
  [查询记录](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/search)
- Bitable overview:
  [多维表格概述](https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview)
- Doc raw content:
  [获取文档纯文本内容](https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/raw_content?lang=zh-CN)
- Doc API overview:
  [文档概述](https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/docx-overview?lang=zh-CN)
