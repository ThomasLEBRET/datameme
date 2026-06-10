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
      return
    } catch {
      // Pas de clipboard write → essai Web Share
    }
  }

  // Essai 2 : Web Share API avec fichier (iOS Safari, Android Chrome)
  if (navigator.canShare) {
    const filename = key.replace(/\.[^.]+$/, '.png')
    const file = new File([pngBlob], filename, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Mème' })
      return
    }
  }

  throw new Error('Copie non supportée sur ce navigateur')
}
