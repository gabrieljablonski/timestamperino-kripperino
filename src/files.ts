import fs from 'fs'
import path from 'path'

export function listFilesInDirectory(directoryPath: string): string[] {
  return fs.readdirSync(directoryPath)
}

export function deleteFilesFromDirectory(directoryPath: string): void {
  listFilesInDirectory(directoryPath).forEach(file => {
    const filePath = path.join(directoryPath, file)
    fs.unlinkSync(filePath)
  })
}
