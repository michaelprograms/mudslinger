"use strict";

// Render the product docs (userdocs/*.md) into static HTML under
// static/public/docs/. This replaces the old mkdocs (Python) toolchain so the
// whole project builds with a single `npm run build` and no second ecosystem.
//
// README.md becomes the docs landing page (index.html); every other *.md keeps
// its basename. Inter-doc links ending in .md are rewritten to .html.

const fs = require("fs");
const path = require("path");
const MarkdownIt = require("markdown-it");

// linkify is off: these docs use explicit markdown links, and auto-linkify
// mangles plain text like "Socket.IO" into bogus URLs.
const md = new MarkdownIt({ html: true, linkify: false, typographer: true });

const SRC_DIR = path.resolve(__dirname, "..", "..", "userdocs");
const OUT_DIR = path.resolve(__dirname, "..", "static", "public", "docs");

// README is the docs landing page; everything else keeps its name.
function outName(base) {
    return base.toLowerCase() === "readme" ? "index" : base;
}

const CSS = `
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  max-width:760px;margin:0 auto;padding:2rem 1.25rem;line-height:1.6;color:#222}
nav{margin-bottom:2rem;padding-bottom:.75rem;border-bottom:1px solid #ddd;font-size:.9rem}
nav a{margin-right:1rem;text-decoration:none;color:#0366d6}
pre{background:#f6f8fa;padding:1rem;overflow:auto;border-radius:6px}
code{background:#f6f8fa;padding:.15em .35em;border-radius:4px}
pre code{background:none;padding:0}
h1,h2{border-bottom:1px solid #eee;padding-bottom:.3rem}
`;

function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error("buildDocs: source dir not found: " + SRC_DIR);
        process.exit(1);
    }

    const mdFiles = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 0) {
        console.error("buildDocs: no .md files in " + SRC_DIR);
        process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Shared nav: back to the client, then one link per doc page.
    const navLinks = ['<a href="/">&larr; Client</a>'].concat(
        mdFiles.map((f) => {
            const base = path.basename(f, ".md");
            const label = base.toLowerCase() === "readme" ? "Home" : base;
            return '<a href="' + outName(base) + '.html">' + label + "</a>";
        })
    );
    const nav = "<nav>" + navLinks.join("") + "</nav>";

    for (const file of mdFiles) {
        const base = path.basename(file, ".md");
        const src = fs.readFileSync(path.join(SRC_DIR, file), "utf8");

        let body = md.render(src);
        // Rewrite inter-doc links: foo.md -> foo.html (README.md -> index.html).
        body = body.replace(/href="([^"]+)\.md"/g, (_m, name) => {
            return 'href="' + outName(path.basename(name)) + '.html"';
        });

        const title =
            base.toLowerCase() === "readme"
                ? "Mudslinger Docs"
                : base + " — Mudslinger Docs";

        const html =
            "<!DOCTYPE html>\n" +
            '<html lang="en">\n' +
            "<head>\n" +
            '<meta charset="utf-8">\n' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
            "<title>" + title + "</title>\n" +
            "<style>" + CSS + "</style>\n" +
            "</head>\n" +
            "<body>\n" +
            nav + "\n" +
            body +
            "</body>\n" +
            "</html>\n";

        const outFile = path.join(OUT_DIR, outName(base) + ".html");
        fs.writeFileSync(outFile, html);
        console.log("buildDocs: wrote " + path.relative(process.cwd(), outFile));
    }
}

main();
