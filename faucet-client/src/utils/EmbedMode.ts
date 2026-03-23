export function isEmbedMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('embed') === '1' || params.get('embed') === 'true';
  } catch {
    return false;
  }
}

export function notifyParentReturnToStart(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!isEmbedMode()) {
    return;
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'powfaucet:return-to-start' }, '*');
    }
  } catch {
    // no-op
  }
}
