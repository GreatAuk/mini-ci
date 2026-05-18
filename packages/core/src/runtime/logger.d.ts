/** 日志接口 */
export interface Logger {
    /** 输出整体运行头 */
    header(message: string, detail?: string): void;
    /** 输出 operation 分组 */
    group(message: string, detail?: string): void;
    /** 输出开始信息 */
    start(message: string, detail?: string): void;
    /** 输出普通信息 */
    info(message: string, detail?: string): void;
    /** 输出提醒信息 */
    remind(message: string, detail?: string): void;
    /** 输出辅助信息 */
    detail(label: string, value: string): void;
    /** 输出警告信息 */
    warn(message: string, detail?: string): void;
    /** 输出错误信息 */
    error(message: string, detail?: string): void;
    /** 输出成功信息 */
    success(message: string, detail?: string): void;
    /** 输出空行 */
    blank(): void;
}
/**
 * 标记错误已经输出过日志。
 *
 * @param error 错误对象
 * @returns 原错误对象
 */
export declare function markErrorLogged(error: Error): Error;
/**
 * 判断错误是否已经输出过日志。
 *
 * @param error 未知错误
 * @returns 是否已记录
 */
export declare function isErrorLogged(error: unknown): boolean;
/**
 * 创建带颜色和分组排版的日志实例。
 *
 * @returns Logger 实例
 */
export declare function createLogger(): Logger;
