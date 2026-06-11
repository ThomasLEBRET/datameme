// OCR et génération de mots-clés via Cloudflare Workers AI

// Seuil minimum de caractères pour considérer qu'une image contient du texte
const OCR_MIN_CHARS = 4;

// Modèle vision (OCR + description)
const MODEL_VISION = '@cf/llava-hf/llava-1.5-7b-hf';

// Nettoie la réponse du modèle : retire les phrases d'enrobage que LLaVA ajoute
// autour du texte extrait ("The text in the image reads: …", etc.)
function cleanOcrResponse(raw) {
  let text = (raw || '').trim();
  text = text.replace(/^(the\s+)?(text|words?|caption)\s+(in|on|of)\s+(the|this)\s+image\s+(is|reads?|says?)\s*:?\s*/i, '');
  text = text.replace(/^(it|the\s+image)\s+(says?|reads?|contains?)\s*:?\s*/i, '');
  text = text.replace(/^["'«\s]+|["'»\s]+$/g, '').trim();
  // Réponses « pas de texte » sous toutes leurs formes
  if (/^(none|n\/a|no\s+(readable\s+|visible\s+)?text|there\s+is\s+no|aucun\s+texte|empty)/i.test(text)) return '';
  return text;
}

/**
 * Extrait le texte d'une image via le modèle vision
 * Retourne { text, hasText }
 */
export async function runOCR(env, imageBuffer) {
  try {
    const result = await env.AI.run(MODEL_VISION, {
      image: [...new Uint8Array(imageBuffer)],
      prompt: 'Transcribe all readable text in this image exactly as written. Reply with the transcription only, no commentary. If there is no readable text, reply with the single word: NONE',
      max_tokens: 512,
    });

    const text = cleanOcrResponse(result.response);
    return {
      text,
      hasText: text.length >= OCR_MIN_CHARS,
    };
  } catch (err) {
    console.error('Erreur OCR :', err);
    return { text: '', hasText: false };
  }
}

/**
 * Demande au modèle vision des mots-clés descriptifs en français
 * Bien plus pertinent pour des mèmes que les classes ImageNet de resnet-50
 */
export async function runDescription(env, imageBuffer) {
  try {
    const result = await env.AI.run(MODEL_VISION, {
      image: [...new Uint8Array(imageBuffer)],
      prompt: `Tu es un expert en mèmes internet. Décris ce mème en une seule phrase dense en français :
- Qui est le personnage ou sujet principal (nom si reconnu, sinon description)
- Quelle est son expression ou action
- Quel texte est visible s'il y en a
- Quelle situation ou émotion ce mème représente typiquement
Réponds uniquement avec la phrase, sans introduction.`,
      max_tokens: 150,
    });
    return (result.response || '').trim();
  } catch (err) {
    console.error('Erreur description :', err);
    return '';
  }
}
