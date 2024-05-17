import ffmpeg from 'fluent-ffmpeg'
import tesseract from 'node-tesseract-ocr'
import path from 'path'

import { deleteFilesFromDirectory } from './files'

interface VideoToImageOptions {
  outputPath?: string
  crop?: { x: number; y: number; w: number; h: number }
}

export default class OCR {
  async videoToImages(
    filepath: string,
    { outputPath: outputPath = 'images', crop }: VideoToImageOptions,
  ) {
    deleteFilesFromDirectory(outputPath)
    return new Promise((resolve, reject) => {
      const command = ffmpeg(filepath)
        .outputFPS(0.25)
        .output(path.join(outputPath, '%03d.png'))
      if (crop) {
        command.videoFilter([`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`])
      }
      command
        .on('end', resolve)
        .on('error', (stdout, stderr) => reject(`${stdout}\n${stderr}`))
        .run()
    })
  }

  async imageToText(filepath: string) {
    return tesseract.recognize(filepath, {
      lang: 'eng',
      oem: 3,
      psm: 7,
    })
  }
}
