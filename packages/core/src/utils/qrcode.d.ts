/**
 * 读取二维码图片中的文本内容。
 *
 * @param imagePath 本地图片路径或网络图片 URL
 * @returns 二维码文本内容
 */
export declare function readQrcodeImageContent(imagePath: string): Promise<string>;
/**
 * 将文本内容转换成二维码输出到控制台。
 *
 * @param content 二维码文本内容
 */
export declare function printQrcode2Terminal(content: string): Promise<void>;
/**
 * 生成二维码图片文件。
 *
 * @param filePath 输出文件路径
 * @param content 二维码文本内容
 */
export declare function generateQrcodeImageFile(filePath: string, content: string): Promise<void>;
//# sourceMappingURL=qrcode.d.ts.map