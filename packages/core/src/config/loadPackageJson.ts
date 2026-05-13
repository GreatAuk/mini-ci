import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * 读取当前项目 package.json。
 *
 * @param cwd 当前工作目录
 * @returns package.json 内容；不存在时返回空对象
 */
export async function loadPackageJson(cwd: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path.join(cwd, "package.json"), "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}
