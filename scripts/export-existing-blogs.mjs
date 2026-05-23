import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(
    "Usage: node export-existing-blogs.mjs <apiBaseUrl> <apiCode> <outputDir>",
  );
  process.exit(1);
}

if (process.argv.length < 5) {
  usage();
}

const apiBaseUrl = process.argv[2].replace(/\/$/, "");
const apiCode = process.argv[3];
const outputDir = path.resolve(process.argv[4]);

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchBlogList(type) {
  const url = `${apiBaseUrl}/blogs/list?code=${apiCode}`;
  const payload = {
    pageNumber: 1,
    pageSize: 100,
    filter: [
      {
        fieldName: "type",
        fieldValue: String(type),
      },
    ],
  };

  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return data.data || [];
}

async function fetchBlogDetail(shortUrl) {
  const url = `${apiBaseUrl}/blogs?code=${apiCode}&shortUrl=${encodeURIComponent(shortUrl)}`;
  const data = await fetchJson(url);
  return data.data;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

async function main() {
  const records = [];
  const shortUrls = new Set();

  for (const type of ["0", "1"]) {
    const list = await fetchBlogList(type);
    for (const item of list) {
      if (!item.shortUrl || shortUrls.has(item.shortUrl)) {
        continue;
      }
      shortUrls.add(item.shortUrl);

      const detail = await fetchBlogDetail(item.shortUrl);
      records.push({
        title: detail.title || item.title || "",
        shortUrl: item.shortUrl,
        subTitle: item.subTitle || "",
        type,
        status: "published",
        blogCoverUrl: detail.blogCoverUrl || item.blogCoverUrl || "",
        seoTitle: detail.seoTitle || detail.title || item.title || "",
        seoDescription:
          detail.seoDescription || item.subTitle || detail.title || "",
        seoTag: detail.seoTag || "",
        updatedAt: detail.updateDate || "",
        authorListJson: JSON.stringify(detail.authorList || []),
        contentHtml: detail.content || "",
        publishedUrl: "",
        docToken: "",
      });
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "feishu-blog-import.json");
  const csvPath = path.join(outputDir, "feishu-blog-import.csv");

  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));

  const header = [
    "title",
    "shortUrl",
    "subTitle",
    "type",
    "status",
    "blogCoverUrl",
    "seoTitle",
    "seoDescription",
    "seoTag",
    "updatedAt",
    "authorListJson",
    "contentHtml",
    "publishedUrl",
    "docToken",
  ];

  const csv = [
    header.join(","),
    ...records.map((record) => header.map((key) => csvEscape(record[key])).join(",")),
  ].join("\n");

  fs.writeFileSync(csvPath, csv);

  console.log(
    JSON.stringify(
      {
        count: records.length,
        jsonPath,
        csvPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
