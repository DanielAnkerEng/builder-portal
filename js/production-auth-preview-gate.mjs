const ALLOWED_ORIGINS = new Set(['http://127.0.0.1:4175', 'http://localhost:4175'])
const PREVIEW_PATH = '/production-auth-preview.html'
const PREVIEW_MODE = 'production-auth-preview'
const PREVIEW_CONFIRMATION = '#confirm-real-production-users'

export function productionAuthPreviewAllowed(locationLike) {
  let url
  try { url = new URL(locationLike.href) } catch { return false }
  return ALLOWED_ORIGINS.has(url.origin)
    && url.pathname === PREVIEW_PATH
    && url.searchParams.size === 1
    && url.searchParams.get('mode') === PREVIEW_MODE
    && url.hash === PREVIEW_CONFIRMATION
}

export async function refreshPreviewFactorStatus(controller) {
  return controller.loadFactors()
}

export const PRODUCTION_AUTH_PREVIEW_URL = `${PREVIEW_PATH}?mode=${PREVIEW_MODE}${PREVIEW_CONFIRMATION}`
