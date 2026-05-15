/**
 * 同步解析 npm 包的入口文件路径。
 *
 * @param pluginName npm 包名
 * @param root 解析基准目录
 * @returns 解析后的绝对路径
 */
export declare function resolveNpmSync(pluginName: string, root: string): string;
/**
 * 同步加载 npm 包默认导出。
 *
 * @param npmName npm 包名
 * @param root 解析基准目录
 * @returns 加载后的模块
 */
export declare function getNpmPkgSync<T = unknown>(npmName: string, root: string): T;
//# sourceMappingURL=npm.d.ts.map
