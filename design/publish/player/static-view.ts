export function PrototypeComments() {
  return null
}

export const posthog = { capture: () => undefined }

export function isPdfFile() {
  return false
}

export function importPdf(): never {
  throw new Error('PDF import requires the Doop editor')
}
