/**
 * A JPEG data URL of the canvas no longer than `maxChars` (lowering the quality, then the
 * size): photos are stored in every resume, so they stay small (the server takes up to 1 MB).
 */
function compact(canvas, maxChars, quality = 0.85) {
  let url = canvas.toDataURL("image/jpeg", quality);
  for (let q = quality - 0.1; url.length > maxChars && q >= 0.45; q -= 0.1) url = canvas.toDataURL("image/jpeg", q);
  if (url.length <= maxChars || canvas.width < 200) return url;
  const smaller = document.createElement("canvas");
  smaller.width = Math.round(canvas.width * 0.75);
  smaller.height = Math.round(canvas.height * 0.75);
  smaller.getContext("2d").drawImage(canvas, 0, 0, smaller.width, smaller.height);
  return compact(smaller, maxChars, 0.8);
}

/** Loads an image file, fixing nothing but size: a JPEG data URL no larger than `max` px and about 150 KB. */
export function readPhoto(file, max = 900) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error("Please choose a JPG, PNG or WebP image."));
    if (file.size > 15 * 1024 * 1024) return reject(new Error("That image is larger than 15 MB."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(compact(canvas, 150_000));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

/**
 * Cuts the chosen square out of `src`. `area` is in image pixels and may reach
 * outside the image when zoomed out; that part is filled with `background`.
 */
export function cropPhoto(src, area, { size = 480, background = "#ffffff" } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
      const scale = size / area.width;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -area.x * scale, -area.y * scale, img.naturalWidth * scale, img.naturalHeight * scale);
      resolve(compact(canvas, 70_000, 0.88));
    };
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}
