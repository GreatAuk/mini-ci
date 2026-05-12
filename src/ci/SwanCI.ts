import { existsSync } from 'node:fs'
import path from 'node:path'
import shell from 'shelljs'
import { resolveNpmSync } from '../utils/npm'
import { generateQrcodeImageFile, printQrcode2Terminal } from '../utils/qrcode'
import { BaseCI } from './BaseCI'

/** 百度小程序上传响应 */
interface UploadResponse {
  /** 体验码内容 */
  schemeUrl: string
}

/** 百度小程序 CI 适配器 */
export class SwanCI extends BaseCI<'mp-baidu'> {
  /** swan-toolkit CLI 路径 */
  private swanBin = ''

  async init(): Promise<void> {
    try {
      this.swanBin = resolveNpmSync('swan-toolkit/bin/swan', this.config.cwd)
    } catch {
      throw new Error('当前平台 mp-baidu 需要安装依赖：swan-toolkit')
    }
  }

  async open() {
    const isMac = process.platform === 'darwin'
    const devToolsInstallPath =
      this.config.platformConfig.devToolsInstallPath ||
      (isMac ? '/Applications/百度开发者工具.app' : 'C:\\Program Files\\swan-ide-gui')
    const cliPath = path.join(devToolsInstallPath, isMac ? '/Contents/MacOS/cli' : '/cli.bat')

    if (!existsSync(cliPath)) {
      throw new Error(`命令行工具路径不存在：${cliPath}`)
    }

    console.log(`start 百度开发者工具... ${this.config.projectPath}`)
    shell.exec(`${cliPath} --project-path ${this.config.projectPath}`)

    return this.createResult(true)
  }

  async preview() {
    const previewQrcodePath = path.join(this.config.projectPath, 'preview.png')
    const swanConfig = this.config.platformConfig
    console.log('start 预览百度小程序')

    return new Promise<ReturnType<typeof this.createResult>>((resolve, reject) => {
      shell.exec(
        `${this.swanBin} preview --project-path ${this.config.projectPath} --token ${swanConfig.token} --min-swan-version ${swanConfig.minSwanVersion || '3.350.6'} --json`,
        async (_code, stdout, stderr) => {
          if (!stderr) {
            try {
              const parsed = JSON.parse(stdout)
              const qrContent = parsed.list[0].url as string
              await printQrcode2Terminal(qrContent)
              await generateQrcodeImageFile(previewQrcodePath, qrContent)
              console.log(
                `预览二维码已生成，存储在:"${previewQrcodePath}"，二维码内容是：${qrContent}`,
              )
              resolve(
                this.createResult(true, {
                  qrCodeContent: qrContent,
                  qrCodeLocalPath: previewQrcodePath,
                }),
              )
            } catch (error) {
              reject(
                new Error(
                  `mp-baidu preview 执行失败：${error instanceof Error ? error.message : error}`,
                ),
              )
            }
          } else {
            reject(new Error(`mp-baidu preview 执行失败：${stderr.split('\n')[0]}`))
          }
        },
      )
    })
  }

  async upload() {
    const swanConfig = this.config.platformConfig
    console.log('start 上传体验版代码到百度后台')
    console.log(`本次上传版本号为："${this.config.version}"，上传描述为："${this.config.desc}"`)

    return new Promise<ReturnType<typeof this.createResult>>((resolve, reject) => {
      shell.exec(
        `${this.swanBin} upload --project-path ${this.config.projectPath} --token ${swanConfig.token} --release-version ${this.config.version} --min-swan-version ${swanConfig.minSwanVersion || '3.350.6'} --desc ${this.config.desc} --json`,
        async (_code, stdout, stderr) => {
          if (!stderr) {
            try {
              const stdoutRes = JSON.parse(stdout) as UploadResponse
              const qrContent = stdoutRes.schemeUrl
              const uploadQrcodePath = path.join(this.config.projectPath, 'upload.png')

              await printQrcode2Terminal(qrContent)
              await generateQrcodeImageFile(uploadQrcodePath, qrContent)
              console.log(
                `体验版二维码已生成，存储在:"${uploadQrcodePath}"，二维码内容是：${qrContent}`,
              )
              resolve(
                this.createResult(true, {
                  qrCodeContent: qrContent,
                  qrCodeLocalPath: uploadQrcodePath,
                }),
              )
            } catch (error) {
              reject(
                new Error(
                  `mp-baidu upload 执行失败：${error instanceof Error ? error.message : error}`,
                ),
              )
            }
          } else {
            reject(new Error(`mp-baidu upload 执行失败：${stderr.split('\n')[0]}`))
          }
        },
      )
    })
  }
}
