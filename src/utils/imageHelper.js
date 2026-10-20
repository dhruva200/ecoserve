// Converts any uploaded image or webcam frame into a compressed 720px JPEG dataURL
export function normalizeImageToJpeg(fileOrDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 720;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let dominantColorHint = 'neutral';
      try {
        const data = ctx.getImageData(
          Math.floor(width * 0.25),
          Math.floor(height * 0.25),
          Math.max(1, Math.floor(width * 0.5)),
          Math.max(1, Math.floor(height * 0.5))
        ).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count > 0) {
          r /= count;
          g /= count;
          b /= count;
          if (r > g + 35 && r > b + 35) dominantColorHint = 'red';
          else if (r > 160 && g > 140 && b < 110) dominantColorHint = 'yellow';
          else if (g > r + 20 && g > b + 20) dominantColorHint = 'green';
        }
      } catch {}

      resolve({
        jpegDataUrl: canvas.toDataURL('image/jpeg', 0.85),
        dominantColorHint,
      });
    };
    img.onerror = () => reject(new Error('Could not load image'));

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
