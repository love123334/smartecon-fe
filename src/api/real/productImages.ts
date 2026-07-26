import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export interface CloudinaryUploadResult {
  url: string
  publicId: string
}

export async function uploadProductImage(file: File): Promise<CloudinaryUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const data = await http.upload<CloudinaryUploadResult>(apiPaths.products.imageUpload, form)
  return {
    url: data.url,
    publicId: data.publicId || `upload-${Date.now()}`,
  }
}
