import { existsSync } from "node:fs";
import axios from "axios";
import Jimp from "jimp";
import jsQR from "jsqr";
import QRCode from "qrcode";

/**
 * 读取二维码图片中的文本内容。
 *
 * @param imagePath 本地图片路径或网络图片 URL
 * @returns 二维码文本内容
 */
export async function readQrcodeImageContent(imagePath: string): Promise<string> {
  let imageBuffer: Buffer | undefined;

  if (!existsSync(imagePath)) {
    const response = await axios({
      method: "get",
      url: imagePath,
      responseType: "arraybuffer",
      timeout: 8000,
    });
    imageBuffer = Buffer.from(response.data as ArrayBuffer);
  }

  const image = imageBuffer ? await Jimp.read(imageBuffer) : await Jimp.read(imagePath);
  const scanData = jsQR(
    new Uint8ClampedArray(image.bitmap.data),
    image.bitmap.width,
    image.bitmap.height,
  );

  if (!scanData) {
    throw new Error("扫描器 jsqr 未能识别出二维码内容");
  }

  return scanData.data;
}

/**
 * 将文本内容转换成二维码输出到控制台。
 *
 * @param content 二维码文本内容
 */
export async function printQrcode2Terminal(content: string): Promise<void> {
  const terminalStr = await QRCode.toString(content, { type: "terminal", small: true });
  console.log(terminalStr);
}

/**
 * 生成二维码图片文件。
 *
 * @param filePath 输出文件路径
 * @param content 二维码文本内容
 */
export async function generateQrcodeImageFile(filePath: string, content: string): Promise<void> {
  await QRCode.toFile(filePath, content, {
    errorCorrectionLevel: "L",
    type: "png",
  });
}
