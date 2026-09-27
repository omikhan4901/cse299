/** Loads an image file, fixing nothing but size: returns a JPEG data URL no larger than `max` px. */
export function readPhoto(file, max = 1200) {
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
      resolve(canvas.toDataURL("image/jpeg", 0.85));
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
export function cropPhoto(src, area, { size = 600, background = "#ffffff" } = {}) {
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
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}
