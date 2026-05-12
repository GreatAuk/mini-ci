import path from 'node:path'
import { getNpmPkgSync } from '../utils/npm'
import { printQrcode2Terminal } from '../utils/qrcode'
import { BaseCI } from './BaseCI'

/** 字节小程序 CI 适配器 */
export class TTCI extends BaseCI<'mp-toutiao'> {
  /** tt-ide-cli 模块 */
  private tt: any

  async init(): Promise<void> {
    try {
      this.tt = getNpmPkgSync('tt-ide-cli', this.config.cwd)
    } catch {
      throw new Error('当前平台 mp-toutiao 需要安装依赖：tt-ide-cli')
    }
  }

  /**
   * 登录字节小程序。
   */
  private async beforeCheck(): Promise<void> {
    const ttConfig = this.config.platformConfig
    await this.tt.loginByEmail({
      email: ttConfig.email,
      password: ttConfig.password,
      dontSaveCookie: false,
    })
  }

  async open() {
    try {
      console.log(`start 启动抖音小程序开发者工具... ${this.config.projectPath}`)
      await this.tt.open({
        project: {
          path: this.config.projectPath,
        },
      })
      console.log('打开 IDE 成功')
      return this.createResult(true)
    } catch (error) {
      throw new Error(`mp-toutiao open 执行失败：${error instanceof Error ? error.message : error}`)
    }
  }

  async preview() {
    await this.beforeCheck()
    try {
      console.log('start 预览抖音小程序')
      const previewQrcodePath = path.join(this.config.projectPath, 'preview.png')
      const ttConfig = this.config.platformConfig

      const previewResult = await this.tt.preview({
        project: {
          path: this.config.projectPath,
        },
        page: {
          path: '',
        },
        qrcode: {
          format: 'imageFile',
          output: previewQrcodePath,
        },
        copyToClipboard: true,
        cache: true,
        ideConfig: {
          skipDomainCheck: ttConfig.setting?.skipDomainCheck,
        },
      })

      console.log(`开发版上传成功 ${new Date().toLocaleString()}`)
      const qrContent = previewResult.shortUrl as string
      await printQrcode2Terminal(qrContent)
      console.log(
        `预览二维码已生成，存储在:"${previewQrcodePath}"，二维码内容是：${qrContent}，过期时间：${new Date(previewResult.expireTime * 1000).toLocaleString()}`,
      )

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: previewQrcodePath,
      })
    } catch (error) {
      throw new Error(
        `mp-toutiao preview 执行失败：${error instanceof Error ? error.message : error}`,
      )
    }
  }

  async upload() {
    await this.beforeCheck()
    try {
      console.log('start 上传代码到抖音开放平台后台')
      console.log(`本次上传版本号为："${this.config.version}"，上传描述为："${this.config.desc}"`)
      const uploadQrcodePath = path.join(this.config.projectPath, 'upload.png')

      const uploadResult = await this.tt.upload({
        project: {
          path: this.config.projectPath,
        },
        qrcode: {
          format: 'imageFile',
          output: uploadQrcodePath,
        },
        version: this.config.version,
        changeLog: this.config.desc,
        needUploadSourcemap: true,
        copyToClipboard: false,
      })

      console.log(`体验版上传成功 ${new Date().toLocaleString()}`)
      const qrContent = uploadResult.shortUrl as string
      await printQrcode2Terminal(qrContent)
      console.log(
        `体验版二维码已生成，存储在:"${uploadQrcodePath}"，二维码内容是："${qrContent}"，过期时间：${new Date(uploadResult.expireTime * 1000).toLocaleString()}`,
      )

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: uploadQrcodePath,
      })
    } catch (error) {
      throw new Error(
        `mp-toutiao upload 执行失败：${error instanceof Error ? error.message : error}`,
      )
    }
  }
}
