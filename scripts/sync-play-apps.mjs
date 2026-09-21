import { mkdir, writeFile } from "node:fs/promises";

const developerName = "Zeno Network Labs";
const developerUrl = "https://play.google.com/store/apps/developer?id=Zeno+Network+Labs&hl=en&gl=US";

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function getHtml(url) {
  const response = await fetch(url, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Google Play returned ${response.status} for ${url}`);
  return response.text();
}

function meta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtml(match[1].trim());
  }
  return "";
}

function findPackages(html) {
  const packages = [];
  const pattern = /href=["']\/store\/apps\/details\?id=([a-zA-Z0-9._-]+)[^"']*["']/g;
  for (const match of html.matchAll(pattern)) {
    if (!packages.includes(match[1])) packages.push(match[1]);
  }
  return packages;
}

const developerHtml = await getHtml(developerUrl);
const packages = findPackages(developerHtml);
if (!packages.length) throw new Error("No Google Play apps were found; refusing to overwrite the current data.");

const apps = [];
for (const packageName of packages) {
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en&gl=US`;
  const html = await getHtml(url);
  const rawTitle = meta(html, "og:title");
  const name = rawTitle.replace(/\s*[-–]\s*Apps on Google Play\s*$/i, "").trim();
  const description = meta(html, "og:description");
  const icon = meta(html, "og:image");
  if (!name || !icon) throw new Error(`Incomplete Google Play metadata for ${packageName}`);
  apps.push({ name, packageName, developer: developerName, description, icon, url });
}

apps.sort((a, b) => a.name.localeCompare(b.name, "en"));
const output = { developer: developerName, developerUrl, apps };
await mkdir("data", { recursive: true });
await writeFile("data/play-apps.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Synced ${apps.length} app(s) from ${developerName}.`);
