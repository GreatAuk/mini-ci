/** CLI 入口选项 */
export interface CliOptions {
  /** 命令参数 */
  argv: string[];
  /** 当前工作目录 */
  cwd?: string;
  /** 是否直接退出进程 */
  exitProcess?: boolean;
}
