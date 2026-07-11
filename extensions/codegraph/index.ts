// extensions/codegraph/index.ts
// CodeGraph 工具集合入口：注册搜索、调用链、影响分析、文件浏览、状态检查等工具

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSearch } from "./tools/search";
import { registerCallers } from "./tools/callers";
import { registerCallees } from "./tools/callees";
import { registerImpact } from "./tools/impact";
import { registerFiles } from "./tools/files";
import { registerStatus } from "./tools/status";
import { registerAffected } from "./tools/affected";
import { registerSync } from "./tools/sync";
import { registerInit } from "./tools/init";

export default function (pi: ExtensionAPI) {
  registerSearch(pi);
  registerCallers(pi);
  registerCallees(pi);
  registerImpact(pi);
  registerFiles(pi);
  registerStatus(pi);
  registerAffected(pi);
  registerSync(pi);
  registerInit(pi);
}
