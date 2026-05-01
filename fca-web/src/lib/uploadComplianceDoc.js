const MIME_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
}

export async function uploadComplianceDoc(supabase, { bucket, ownerId, side, itemId, file }) {
  const ext = MIME_EXT[file.type]
  if (!ext) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}`)
  }
  const filePath = `${ownerId}/compliance/${side}/${itemId}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  return {
    filePath,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  }
}
