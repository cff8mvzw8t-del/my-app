/** Persist a compact, uncropped copy instead of a page-lifetime blob URL. */
export async function prepareProfilePhoto(uri: string): Promise<string> {
  let dataUri = uri;
  if (uri.startsWith('blob:')) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Photo unavailable');
    const blob = await response.blob();
    dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Photo unavailable'));
      reader.onerror = () => reject(new Error('Photo unavailable'));
      reader.readAsDataURL(blob);
    });
  }
  if (!dataUri.startsWith('data:image/')) return dataUri;
  const image = document.createElement('img');
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Photo unavailable')); image.src = dataUri; });
  const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  if (ratio === 1 && dataUri.length < 350000) return dataUri;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) return dataUri;
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
