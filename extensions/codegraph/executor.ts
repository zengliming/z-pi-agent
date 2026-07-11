// extensions/codegraph/executor.ts
// CodeGraph CLI 执行引擎：查找二进制、检测项目、执行命令、解析 JSON

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

// ── 类型 ──

export interface CgResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CodeGraphNode {
  id: string;
  kind: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  signature?: string | null;
  visibility?: string | null;
  isExported: boolean;
  isAsync: boolean;
  isStatic: boolean;
  isAbstract: boolean;
  docstring?: string | null;
  updatedAt: number;
}

// ── 执行器 ──

export class CodeGraphExecutor {
  // module-level 缓存（跨工具调用共享）
  private static binary: string | null = null;
  private static projectRoots = new Map<string, string | null>();

  /** 查找 codegraph CLI 入口（npm-shim.js 或直接二进制） */
  private findBinary(): string {
    if (CodeGraphExecutor.binary) return CodeGraphExecutor.binary;

    // 策略 1: 通过 npm-shim.js（最可靠的方式）
    const nodeBin = process.execPath;
    const shimCandidates: string[] = [];

    // Windows npm 全局
    const appData = process.env.APPDATA;
    if (appData) {
      shimCandidates.push(
        join(appData, "npm", "node_modules", "@colbymchenry", "codegraph", "npm-shim.js")
      );
    }
    // Unix / WSL npm 全局
    const home = process.env.HOME || process.env.USERPROFILE || "";
    shimCandidates.push(
      "/usr/local/lib/node_modules/@colbymchenry/codegraph/npm-shim.js",
      "/usr/lib/node_modules/@colbymchenry/codegraph/npm-shim.js",
      join(home, ".npm-global", "lib", "node_modules", "@colbymchenry", "codegraph", "npm-shim.js"),
      join(home, "npm", "lib", "node_modules", "@colbymchenry", "codegraph", "npm-shim.js"),
    );

    for (const shim of shimCandidates) {
      if (existsSync(shim)) {
        const cmd = `"${nodeBin}" "${shim}"`;
        CodeGraphExecutor.binary = cmd;
        return cmd;
      }
    }

    // 策略 2: 尝试通过 PATH 直接使用 codegraph
    try {
      execSync("codegraph --version", {
        encoding: "utf8",
        timeout: 5000,
        stdio: "pipe",
        windowsHide: true,
      });
      CodeGraphExecutor.binary = "codegraph";
      return "codegraph";
    } catch {
      // fall through
    }

    // 策略 3: Windows npm shim（.cmd 文件）
    if (appData) {
      const winShim = join(appData, "npm", "codegraph.cmd");
      if (existsSync(winShim)) {
        CodeGraphExecutor.binary = `"${winShim}"`;
        return `"${winShim}"`;
      }
    }

    // 策略 4: 查找 standalone 安装的二进制
    const standaloneCandidates = [
      "/usr/local/bin/codegraph",
      "/usr/bin/codegraph",
      join(home, ".codegraph", "bundles", "*", "bin", "codegraph"),
      nodeBin.replace(/node(.exe)?$/, "codegraph"),
    ];
    for (const candidate of standaloneCandidates) {
      // 跳过通配符路径
      if (candidate.includes("*")) continue;
      if (existsSync(candidate)) {
        CodeGraphExecutor.binary = `"${candidate}"`;
        return `"${candidate}"`;
      }
    }

    // 最后尝试直接使用 codegraph（依赖 PATH）
    CodeGraphExecutor.binary = "codegraph";
    return "codegraph";
  }

  /** 从 cwd 向上遍历，查找包含 .codegraph/ 的项目根目录 */
  findProjectRoot(cwd: string): string | null {
    const cached = CodeGraphExecutor.projectRoots.get(cwd);
    if (cached !== undefined) return cached;

    let dir = resolve(cwd);
    while (true) {
      if (existsSync(join(dir, ".codegraph"))) {
        CodeGraphExecutor.projectRoots.set(cwd, dir);
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    CodeGraphExecutor.projectRoots.set(cwd, null);
    return null;
  }

  /** 检查环境和项目是否就绪 */
  checkReady(
    cwd: string
  ): { ready: true } | { ready: false; message: string } {
    // 检查二进制
    const bin = this.findBinary();
    try {
      execSync(`${bin} --version`, {
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe",
        windowsHide: true,
      });
    } catch {
      return {
        ready: false,
        message:
          "❌ CodeGraph is not detected.\n\n" +
          "Install the latest version:\n" +
          "  npm i -g @colbymchenry/codegraph\n\n" +
          "Or use the standalone installer:\n" +
          "  curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh  (macOS/Linux)\n" +
          "  irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex  (Windows)",
      };
    }

    // 检查项目是否初始化
    const root = this.findProjectRoot(cwd);
    if (!root) {
      return {
        ready: false,
        message:
          "❌ This project is not initialized for CodeGraph.\n\n" +
          "Initialize and index the project:\n" +
          "  codegraph init\n" +
          "  codegraph index\n\n" +
          "This will create the .codegraph/ directory and build the symbol graph.",
      };
    }

    return { ready: true };
  }

  /** 获取项目根路径 */
  getProjectRoot(cwd: string): string | null {
    return this.findProjectRoot(cwd);
  }

  /** 执行 codegraph CLI 命令并解析 JSON 输出 */
  exec<T>(args: string[], cwd: string): CgResult<T> {
    const bin = this.findBinary();
    const projRoot = this.findProjectRoot(cwd);
    const workDir = projRoot || cwd;

    // 转义含空格的参数
    const escaped = args.map((a) =>
      a.includes(" ") ? `"${a.replace(/"/g, '\\"')}"` : a
    );
    const cmd = `${bin} ${escaped.join(" ")}`;

    try {
      const stdout = execSync(cmd, {
        cwd: workDir,
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      }).trim();

      if (!stdout) return { success: true, data: undefined as unknown as T };

      // Try JSON parse first; fall back to raw string for non-JSON output (e.g. sync, init)
      try {
        return { success: true, data: JSON.parse(stdout) as T };
      } catch {
        return { success: true, data: stdout as unknown as T };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 去掉栈追踪噪音，保留用户可读的错误信息
      const clean = msg
        .split("\n")
        .filter(
          (l) =>
            !/^\s+at\s/.test(l) &&
            !l.includes("node:internal") &&
            !l.includes("node:child_process")
        )
        .join("\n")
        .trim();
      return { success: false, error: clean || msg };
    }
  }
}
