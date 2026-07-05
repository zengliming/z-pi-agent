// extensions/file-finder.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ── 环境检测 ──

let _rgAvailable: boolean | null = null;
let _isWindows: boolean | null = null;

function isWindows(): boolean {
  if (_isWindows === null) _isWindows = process.platform === "win32";
  return _isWindows;
}

function hasRg(): boolean {
  if (_rgAvailable !== null) return _rgAvailable;
  try {
    execSync("rg --version", { encoding: "utf8", timeout: 3000, stdio: "pipe" });
    _rgAvailable = true;
  } catch {
    _rgAvailable = false;
  }
  return _rgAvailable;
}

function shell(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 15000, stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

// ── 类型 ──

interface FindParams {
  pattern: string;
  searchType?: "name" | "content" | "list";
  directory?: string;
  fileTypes?: string;
  maxResults?: number;
  maxDepth?: number;
  caseSensitive?: boolean;
  ignoreDirs?: string;
}

interface FileResult {
  path: string;
  size: number;
  modified: string;
}

// ── 原生工具：name 搜索 (find) ──

function nativeFindByName(
  dir: string,
  pattern: string,
  maxDepth: number,
  ignored: string[],
  fileTypes: string[],
  limit: number
): string {
  const ignoreArgs = ignored.map((d) => `-not -path "*/${d}/*"`).join(" ");
  const namePattern = pattern.includes("*") ? pattern : `*${pattern}*`;

  let typeFilter = "";
  if (fileTypes.length > 0) {
    const conds = fileTypes.map((t) => `-name "*${t}"`).join(" -o ");
    typeFilter = `\\( ${conds} \\)`;
  }

  return shell(
    `find "${dir}" -maxdepth ${maxDepth} ${ignoreArgs} ${typeFilter} -name "${namePattern}" -type f 2>/dev/null | head -${limit}`,
    "/"
  );
}

// ── 原生工具：content 搜索 (rg/grep) ──

function nativeSearchContent(
  dir: string,
  pattern: string,
  maxDepth: number,
  ignored: string[],
  fileTypes: string[],
  caseSensitive: boolean,
  limit: number
): string {
  const caseFlag = caseSensitive ? "" : "-i";
  const escaped = pattern.replace(/"/g, '\\"');

  if (hasRg()) {
    const ignoreArgs = ignored.map((d) => `--glob '!${d}/**'`).join(" ");
    let typeFilter = "";
    if (fileTypes.length > 0) {
      const typeRules = fileTypes.map((t) => {
        const name = t.replace(/^\./, "");
        return `--type-add "custom_${name}:*.${name}" --type custom_${name}`;
      });
      typeFilter = typeRules.join(" ");
    }
    return shell(
      `rg ${caseFlag} --max-depth ${maxDepth} --max-count 1 ${typeFilter} ${ignoreArgs} -n "${escaped}" "${dir}" 2>/dev/null | head -${limit}`,
      "/"
    );
  }

  // fallback to grep
  const grepCase = caseSensitive ? "" : "-i";
  const includeArgs = fileTypes.map((t) => `--include="*${t}"`).join(" ");
  const excludeArgs = ignored.map((d) => `--exclude-dir="${d}"`).join(" ");
  return shell(
    `grep -rn ${grepCase} ${includeArgs} ${excludeArgs} --max-depth=${maxDepth} "${escaped}" "${dir}" 2>/dev/null | head -${limit}`,
    "/"
  );
}

// ── 原生工具：list (ls) ──

function nativeList(dir: string, limit: number): string {
  return shell(`ls -la "${dir}" 2>/dev/null | head -${limit}`, "/");
}

// ── Node.js fallback：name 搜索 ──

function matchGlob(name: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
    "i"
  );
  return regex.test(name);
}

function nodeFindByName(
  dir: string,
  pattern: string,
  depth: number,
  maxDepth: number,
  ignored: string[],
  fileTypes: string[],
  results: FileResult[],
  limit: number
): void {
  if (depth > maxDepth || results.length >= limit) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (results.length >= limit) break;
    if (ignored.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      nodeFindByName(full, pattern, depth + 1, maxDepth, ignored, fileTypes, results, limit);
    } else if (entry.isFile()) {
      if (fileTypes.length > 0 && !fileTypes.includes(path.extname(entry.name).toLowerCase())) continue;
      if (matchGlob(entry.name, pattern)) {
        try {
          const stat = fs.statSync(full);
          results.push({ path: full, size: stat.size, modified: stat.mtime.toISOString() });
        } catch { /* skip */ }
      }
    }
  }
}

// ── Node.js fallback：content 搜索 ──

function nodeSearchContent(
  dir: string,
  pattern: string,
  depth: number,
  maxDepth: number,
  ignored: string[],
  fileTypes: string[],
  caseSensitive: boolean,
  results: string[],
  limit: number
): void {
  if (depth > maxDepth || results.length >= limit) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const regex = new RegExp(pattern, caseSensitive ? "g" : "gi");
  for (const entry of entries) {
    if (results.length >= limit) break;
    if (ignored.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      nodeSearchContent(full, pattern, depth + 1, maxDepth, ignored, fileTypes, caseSensitive, results, limit);
    } else if (entry.isFile()) {
      if (fileTypes.length > 0 && !fileTypes.includes(path.extname(entry.name).toLowerCase())) continue;
      try {
        const content = fs.readFileSync(full, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length && results.length < limit; i++) {
          if (regex.test(lines[i])) {
            results.push(`${full}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      } catch { /* skip binary / unreadable */ }
    }
  }
}

// ── Node.js fallback：list ──

function nodeList(dir: string, limit: number): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (let i = 0; i < entries.length && out.length < limit; i++) {
    const e = entries[i];
    const full = path.join(dir, e.name);
    try {
      const stat = fs.statSync(full);
      const type = e.isDirectory() ? "d" : e.isSymbolicLink() ? "l" : "-";
      const size = formatSize(stat.size);
      const date = formatDate(stat.mtime.toISOString());
      out.push(`${type} ${size.padStart(8)} ${date} ${e.name}`);
    } catch {
      out.push(`? ${e.name}`);
    }
  }
  return out;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── 注册工具 ──

export default function (pi: ExtensionAPI) {
  // 预热环境检测
  const _rg = hasRg();
  const _win = isWindows();

  pi.registerTool({
    name: "file_finder",
    label: "File Finder",
    description:
      "Quickly find and match files by name pattern (glob), search file contents (regex), or list directory contents. Uses native tools (find/rg/ls) on Unix, Node.js fs on Windows.",
    parameters: Type.Object({
      pattern: Type.String({
        description:
          "Search pattern. 'name': glob like '*.ts'. 'content': text/regex. 'list': directory path (use '.' for cwd).",
      }),
      searchType: Type.Optional(
        Type.String({
          default: "name",
          description: "Search type: 'name' (glob), 'content' (grep), or 'list' (ls).",
        })
      ),
      directory: Type.Optional(Type.String({ description: "Directory to search. Defaults to cwd." })),
      fileTypes: Type.Optional(
        Type.String({ description: "Comma-separated extensions, e.g. '.ts,.js,.json'" })
      ),
      maxResults: Type.Optional(
        Type.Number({ default: 50, description: "Max results (1-500)." })
      ),
      maxDepth: Type.Optional(
        Type.Number({ default: 5, description: "Max directory depth (1-20)." })
      ),
      caseSensitive: Type.Optional(
        Type.Boolean({ default: false, description: "Case-sensitive search." })
      ),
      ignoreDirs: Type.Optional(
        Type.String({
          description: "Comma-separated dirs to ignore. Default: 'node_modules,.git,dist,build,.next'.",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const {
        pattern,
        searchType = "name",
        directory = ctx.cwd,
        fileTypes,
        maxResults = 50,
        maxDepth = 5,
        caseSensitive = false,
        ignoreDirs = "node_modules,.git,dist,build,.next",
      } = params as FindParams;

      const dir = path.resolve(directory || ctx.cwd);
      const limit = Math.min(Math.max(maxResults, 1), 500);
      const depth = Math.min(Math.max(maxDepth, 1), 20);
      const ignored = ignoreDirs.split(",").map((d) => d.trim()).filter(Boolean);
      const types = fileTypes
        ? fileTypes.split(",").map((t) => t.trim().toLowerCase()).map((t) => (t.startsWith(".") ? t : `.${t}`)).filter(Boolean)
        : [];

      if (!fs.existsSync(dir)) {
        return { content: [{ type: "text", text: `Directory not found: ${dir}` }], details: { error: "directory_not_found" } };
      }
      if (!fs.statSync(dir).isDirectory()) {
        return { content: [{ type: "text", text: `Not a directory: ${dir}` }], details: { error: "not_a_directory" } };
      }

      const useNative = !isWindows();

      switch (searchType) {
        // ── list ──
        case "list": {
          const targetDir = pattern === "." ? dir : path.resolve(pattern);
          if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
            return { content: [{ type: "text", text: `Not found: ${targetDir}` }], details: { error: "not_found" } };
          }
          if (useNative) {
            const raw = nativeList(targetDir, limit);
            const lines = raw.split("\n").filter(Boolean);
            return {
              content: [{ type: "text", text: [`Directory: ${targetDir}`, "", ...lines].join("\n") }],
              details: { results: lines.length },
            };
          }
          const lines = nodeList(targetDir, limit);
          return {
            content: [{ type: "text", text: [`Directory: ${targetDir}`, "", ...lines].join("\n") }],
            details: { results: lines.length },
          };
        }

        // ── content ──
        case "content": {
          if (useNative) {
            const raw = nativeSearchContent(dir, pattern, depth, ignored, types, caseSensitive, limit);
            const lines = raw.split("\n").filter(Boolean);
            if (lines.length === 0) {
              return { content: [{ type: "text", text: `No matches for "${pattern}" in ${dir}` }], details: { results: 0 } };
            }
            return {
              content: [{ type: "text", text: [`${lines.length} match(es) for "${pattern}":`, `Directory: ${dir}`, "", ...lines].join("\n") }],
              details: { results: lines.length, searchType: "content", pattern, directory: dir, truncated: lines.length >= limit, engine: hasRg() ? "rg" : "grep" },
            };
          }
          const results: string[] = [];
          nodeSearchContent(dir, pattern, 1, depth, ignored, types, caseSensitive, results, limit);
          if (results.length === 0) {
            return { content: [{ type: "text", text: `No matches for "${pattern}" in ${dir}` }], details: { results: 0 } };
          }
          return {
            content: [{ type: "text", text: [`${results.length} match(es) for "${pattern}":`, `Directory: ${dir}`, "", ...results].join("\n") }],
            details: { results: results.length, searchType: "content", pattern, directory: dir, truncated: results.length >= limit, engine: "node" },
          };
        }

        // ── name (default) ──
        default: {
          if (useNative) {
            const raw = nativeFindByName(dir, pattern, depth, ignored, types, limit);
            const lines = raw.split("\n").filter(Boolean);
            if (lines.length === 0) {
              return { content: [{ type: "text", text: `No files matching "${pattern}" in ${dir}` }], details: { results: 0 } };
            }
            return {
              content: [{ type: "text", text: [`${lines.length} file(s) matching "${pattern}":`, `Directory: ${dir}`, "", ...lines].join("\n") }],
              details: { results: lines.length, searchType: "name", pattern, directory: dir, truncated: lines.length >= limit, engine: "find" },
            };
          }
          const results: FileResult[] = [];
          nodeFindByName(dir, pattern, 1, depth, ignored, types, results, limit);
          if (results.length === 0) {
            return { content: [{ type: "text", text: `No files matching "${pattern}" in ${dir}` }], details: { results: 0 } };
          }
          const lines = results.map((r) => `${formatSize(r.size).padStart(8)} ${formatDate(r.modified)} ${r.path}`);
          return {
            content: [{ type: "text", text: [`${lines.length} file(s) matching "${pattern}":`, `Directory: ${dir}`, "", ...lines].join("\n") }],
            details: { results: lines.length, searchType: "name", pattern, directory: dir, truncated: lines.length >= limit, engine: "node" },
          };
        }
      }
    },
  });
}