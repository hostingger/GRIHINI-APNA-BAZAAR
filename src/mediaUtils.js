const VIDEO_EXTENSION = /\.(?:mp4|webm|mov|m4v|avi|mkv)(?:[?#].*)?$/i;

/** Accept usable image data/URLs, but never treat a video URL as a product photo. */
export function isUsableProductImage(value) {
  const source = String(value || '').trim();
  if (!source || /^data:video\//i.test(source) || VIDEO_EXTENSION.test(source)) return false;
  if (/^data:image\/(?:jpeg|jpg|png|webp|gif|avif);base64,/i.test(source)) return true;
  if (/^https?:\/\//i.test(source)) return true;
  // Local public assets are valid, but protocol-relative URLs are intentionally rejected.
  return /^\/(?!\/)[^\s]+/.test(source);
}

export function hasUsableProductImage(product) {
  if (!product || typeof product !== 'object') return false;
  if (isUsableProductImage(product.image)) return true;
  return Array.isArray(product.images) && product.images.some(isUsableProductImage);
}
