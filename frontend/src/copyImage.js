// Utilitaire de copie d'image — fetch via le proxy Worker pour éviter les blocages CORS R2

const WORKER_URL = 'https://datameme-worker.th-lebret.workers.dev'

// Extrait la clé R2 depuis l'URL publique de l'image
function r2KeyFromUrl(imageUrl) {
  return imageUrl.split('/').pop()
}

export async function copyImageToClipboard(imageUrl) {
  const key = r2KeyFromUrl(imageUrl)
  const proxyUrl = `${WORKER_URL}/api/proxy/${key}`

  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error('Fetch échoué')

  const blob = await res.blob()

  // Convertir en PNG via canvas (seul format universellement supporté par ClipboardItem)
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d').drawImage(bmp, 0, 0)
  const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'))

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
}
