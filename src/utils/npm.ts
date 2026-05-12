import { createRequire } from "node:module";
import resolve from "resolve";

const require = createRequire(import.meta.url);

/** npm 包解析缓存 */
const npmCached = new Map<string, string>();

/**
 * 同步解析 npm 包的入口文件路径。
 *
 * @param pluginName npm 包名
 * @param root 解析基准目录
 * @returns 解析后的绝对路径
 */
export function resolveNpmSync(pluginName: string, root: string): string {
  const cacheKey = `${root}:${pluginName}`;
  const cached = npmCached.get(cacheKey);

  if (cached) {
    return cached;
  }

  const resolved = resolve.sync(pluginName, { basedir: root });
  npmCached.set(cacheKey, resolved);
  return resolved;
}

/**
 * 同步加载 npm 包默认导出。
 *
 * @param npmName npm 包名
 * @param root 解析基准目录
 * @returns 加载后的模块
 */
export function getNpmPkgSync<T = unknown>(npmName: string, root: string): T {
  const npmPath = resolveNpmSync(npmName, root);
  return require(npmPath) as T;
}
