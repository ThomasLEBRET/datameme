// Utilitaire de copie d'image — fetch via le proxy Worker pour éviter les blocages CORS R2

const WORKER_URL = 'https://datameme-worker.th-lebret.workers.dev'

function r2KeyFromUrl(imageUrl) {
  return imageUrl.split('/').pop()
}

// Convertit un blob image en PNG via canvas, sans createImageBitmap (absent sur iOS Safari)
function blobToPngBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob échoué')), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Chargement image échoué')) }
    img.src = objectUrl
  })
}

export async function copyImageToClipboard(imageUrl) {
  const key = r2KeyFromUrl(imageUrl)
  const proxyUrl = `${WORKER_URL}/api/proxy/${key}`

  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error('Fetch échoué')
  const blob = await res.blob()

  const pngBlob = await blobToPngBlob(blob)

  // Essai 1 : Clipboard API (desktop Chrome, Safari 13.1+)
  if (navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
      return 'copied'
    } catch {
      // Pas de clipboard write → essai Web Share
    }
  }

  // Essai 2 : Web Share API avec fichier (iOS Safari, Android Chrome)
  if (navigator.canShare) {
    const shareFilename = key.replace(/\.[^.]+$/, '.png')
    const shareFile = new File([pngBlob], shareFilename, { type: 'image/png' })
    if (navigator.canShare({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile], title: 'Mème' })
      return 'shared'
    }
  }

  // Fallback final : téléchargement (Firefox mobile, navigateurs anciens)
  const dlUrl = URL.createObjectURL(pngBlob)
  const a = document.createElement('a')
  a.href = dlUrl
  a.download = key.replace(/\.[^.]+$/, '.png')
  a.click()
  setTimeout(() => URL.revokeObjectURL(dlUrl), 1000)
  return 'downloaded'
}
