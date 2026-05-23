import http from "node:http";
import feishuBlogCms from "./feishu-blog-cms.js";
import previewPage from "./preview-page.js";

const port = Number(process.env.PORT || 4310);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    previewPage(req, res);
    return;
  }

  feishuBlogCms(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: 404, msg: "Not found" }, null, 2));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Feishu blog CMS adapter listening on http://127.0.0.1:${port}`);
});
