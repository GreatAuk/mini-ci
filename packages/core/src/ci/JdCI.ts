import path from "node:path";
import { getNpmPkgSync } from "../utils/npm";
import {
  generateQrcodeImageFile,
  printQrcode2Terminal,
  readQrcodeImageContent,
} from "../utils/qrcode";
import { BaseCI } from "./BaseCI";

/** 京东小程序 CI 适配器 */
export class JdCI extends BaseCI<"mp-jd"> {
  /** jd-miniprogram-ci 模块 */
  private jdCi: any;

  async init(): Promise<void> {
    try {
      this.jdCi = getNpmPkgSync("jd-miniprogram-ci", this.config.cwd);
    } catch {
      throw new Error("当前平台 mp-jd 需要安装依赖：jd-miniprogram-ci");
    }
  }

  async open() {
    this.logger.warn("京东小程序不支持 open 操作");
    return this.createResult(true);
  }

  async preview() {
    const { privateKey, ignores } = this.requirePlatformConfig();
    const previewQrcodePath =
      this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.jpg");

    try {
      this.logger.detail("version", this.config.version);
      this.logger.detail("desc", this.config.desc);
      const result = await this.jdCi.preview({
        desc: this.config.desc,
        privateKey,
        projectPath: this.config.projectPath,
        uv: this.config.version,
        qrcodeFormat: "image",
        ignores,
      });

      const qrcodeContent = await readQrcodeImageContent(result.imgUrl);
      await generateQrcodeImageFile(previewQrcodePath, qrcodeContent);
      await printQrcode2Terminal(qrcodeContent);
      this.logger.success("预览二维码已生成");
      this.logger.detail("path", previewQrcodePath);
      this.logger.detail("qr", qrcodeContent);

      return this.createResult(true, {
        qrCodeContent: qrcodeContent,
        qrCodeLocalPath: previewQrcodePath,
      });
    } catch (error) {
      throw new Error(`mp-jd preview 执行失败：${error instanceof Error ? error.message : error}`);
    }
  }

  async upload() {
    const { privateKey, robot, ignores } = this.requirePlatformConfig();
    const uploadQrcodePath =
      this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.jpg");

    try {
      this.logger.detail("version", this.config.version);
      this.logger.detail("desc", this.config.desc);
      const result = await this.jdCi.upload({
        desc: this.config.desc,
        privateKey,
        projectPath: this.config.projectPath,
        uv: this.config.version,
        qrcodeFormat: "image",
        robot,
        ignores,
      });

      const qrcodeContent = await readQrcodeImageContent(result.imgUrl);
      await generateQrcodeImageFile(uploadQrcodePath, qrcodeContent);
      await printQrcode2Terminal(qrcodeContent);
      this.logger.success("体验版二维码已生成");
      this.logger.detail("path", uploadQrcodePath);
      this.logger.detail("qr", qrcodeContent);

      return this.createResult(true, {
        qrCodeContent: qrcodeContent,
        qrCodeLocalPath: uploadQrcodePath,
      });
    } catch (error) {
      throw new Error(`mp-jd upload 执行失败：${error instanceof Error ? error.message : error}`);
    }
  }
}
