/**
 * 读取当前项目 package.json。
 *
 * @param cwd 当前工作目录
 * @returns package.json 内容；不存在时返回空对象
 */
export declare function loadPackageJson(cwd: string): Promise<Record<string, unknown>>;
