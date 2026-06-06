// Qualitätsfilter gegen Whisper-Artefakte bei sehr kurzen/leeren Aufnahmen.
// Treue Portierung von TranscriptionQualityService aus dem macOS-Original (reine Logik).

export const MINIMUM_RECORDING_SECONDS = 0.3

export function shouldRejectRecording(durationSeconds: number): boolean {
  return durationSeconds < MINIMUM_RECORDING_SECONDS
}

export function cleanedTranscript(text: string): string {
  return text.trim()
}

// Gewinnt den Rohtext aus der rohen Transkription: säubert ihn und prüft ihn in einem Schritt
// auf ein Artefakt. Liefert den gesäuberten Rohtext, oder null, wenn die Aufnahme als Artefakt
// verworfen wird. Kapselt die feste Reihenfolge säubern→prüfen, die sonst der Aufrufer dirigiert.
// Hinweis: Die Artefakt-Heuristik ist ein Dauer/Länge-Proxy für Whisper-Halluzinationen auf sehr
// kurzen/stillen Clips. Falls die Pipeline sie später bereitstellt, sind compression_ratio,
// avg_logprob, no_speech_prob oder eine VAD die robusteren Signale (siehe arXiv:2501.11378).
export function rohtextAus(raw: string, recordingSeconds: number): string | null {
  const rohtext = cleanedTranscript(raw)
  if (isLikelyArtifact(rohtext, recordingSeconds)) return null
  return rohtext
}

// Intern: Implementierungsdetail von rohtextAus. Die feste Reihenfolge säubern→prüfen lebt dort,
// nicht mehr beim Aufrufer.
function isLikelyArtifact(text: string, recordingSeconds: number): boolean {
  const cleaned = cleanedTranscript(text)
  if (cleaned === '') return true

  const letters = (cleaned.match(/\p{L}/gu) ?? []).length
  if (letters === 0) return true

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (recordingSeconds < 0.55 && (words.length >= 5 || cleaned.length >= 32)) return true

  if (recordingSeconds < 0.8 && cleaned.length >= 56) return true

  return false
}
