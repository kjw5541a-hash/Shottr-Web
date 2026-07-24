/**
 * Shottr Web - Auto Stitching Engine (js/stitching.js)
 * 1) 원본 단순 나열(Raw Concatenation) & 2) Smart Overlap Stitching 분리
 */

const StitchEngine = {
  MAX_CANVAS_WIDTH: 1080,

  /**
   * [1단계] 변환 없이 원본 그대로 위에서 아래로 단순 연속 배치 (Raw Stitching)
   */
  concatImagesRaw(images) {
    if (!images || images.length === 0) return null;

    const firstW = images[0].naturalWidth || images[0].width;
    const targetWidth = Math.min(firstW, this.MAX_CANVAS_WIDTH);
    
    let totalHeight = 0;
    const scaledCanvasList = [];

    images.forEach(img => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const scale = targetWidth / origW;
      const h = Math.round(origH * scale);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0, targetWidth, h);

      scaledCanvasList.push(tempCanvas);
      totalHeight += h;
    });

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = targetWidth;
    resultCanvas.height = totalHeight;
    const ctx = resultCanvas.getContext('2d');

    ctx.fillStyle = '#0D0E11';
    ctx.fillRect(0, 0, targetWidth, totalHeight);

    let currentY = 0;
    scaledCanvasList.forEach(canvas => {
      ctx.drawImage(canvas, 0, currentY);
      currentY += canvas.height;
    });

    return resultCanvas;
  },

  /**
   * [2단계] 겹치는 픽셀 영역 탐지 및 스마트 스티칭 (Smart Overlap Stitching)
   */
  stitchImages(images, manualOverlap = null) {
    if (!images || images.length === 0) return null;

    if (images.length === 1) {
      return this.concatImagesRaw(images);
    }

    const firstW = images[0].naturalWidth || images[0].width;
    const targetWidth = Math.min(firstW, this.MAX_CANVAS_WIDTH);
    const scaledHeights = [];
    const normalizedImages = [];

    images.forEach(img => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const scale = targetWidth / origW;
      const h = Math.round(origH * scale);
      scaledHeights.push(h);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0, targetWidth, h);
      normalizedImages.push(tempCanvas);
    });

    const offsets = [0];

    for (let i = 0; i < normalizedImages.length - 1; i++) {
      const topImgCtx = normalizedImages[i].getContext('2d');
      const botImgCtx = normalizedImages[i + 1].getContext('2d');

      const topH = scaledHeights[i];
      const botH = scaledHeights[i + 1];

      let bestOverlap = 0;
      if (manualOverlap !== null && manualOverlap !== undefined) {
        bestOverlap = manualOverlap;
      } else {
        bestOverlap = this.findBestOverlap(topImgCtx, botImgCtx, targetWidth, topH, botH);
      }

      const prevY = offsets[i];
      const nextY = prevY + topH - bestOverlap;
      offsets.push(nextY);
    }

    const totalHeight = offsets[offsets.length - 1] + scaledHeights[scaledHeights.length - 1];

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = targetWidth;
    resultCanvas.height = totalHeight;
    const ctx = resultCanvas.getContext('2d');

    ctx.fillStyle = '#0D0E11';
    ctx.fillRect(0, 0, targetWidth, totalHeight);

    normalizedImages.forEach((imgCanvas, idx) => {
      ctx.drawImage(imgCanvas, 0, offsets[idx]);
    });

    return resultCanvas;
  },

  findBestOverlap(topCtx, botCtx, width, topH, botH) {
    const sampleSearchRange = Math.min(Math.floor(topH * 0.5), botH);
    const minOverlap = 20;

    const sampleW = 100;
    const stepX = Math.max(1, Math.floor(width / sampleW));

    const topData = topCtx.getImageData(0, topH - sampleSearchRange, width, sampleSearchRange).data;
    const botData = botCtx.getImageData(0, 0, width, sampleSearchRange).data;

    let minDiff = Infinity;
    let bestOverlap = 80;

    for (let overlap = minOverlap; overlap < sampleSearchRange; overlap += 3) {
      let diff = 0;
      let sampleCount = 0;

      const topStartRow = sampleSearchRange - overlap;
      const botStartRow = 0;

      for (let r = 0; r < overlap; r += 3) {
        const topRowIdx = (topStartRow + r) * width * 4;
        const botRowIdx = (botStartRow + r) * width * 4;

        for (let c = 0; c < width; c += stepX) {
          const idx = c * 4;
          const rDiff = Math.abs(topData[topRowIdx + idx] - botData[botRowIdx + idx]);
          const gDiff = Math.abs(topData[topRowIdx + idx + 1] - botData[botRowIdx + idx + 1]);
          const bDiff = Math.abs(topData[topRowIdx + idx + 2] - botData[botRowIdx + idx + 2]);

          diff += (rDiff + gDiff + bDiff);
          sampleCount++;
        }
      }

      const avgDiff = diff / sampleCount;

      if (avgDiff < minDiff) {
        minDiff = avgDiff;
        bestOverlap = overlap;
      }
    }

    return bestOverlap;
  },

  async extractFramesFromVideo(videoFile, videoElement) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(videoFile);
      videoElement.src = url;

      videoElement.onloadedmetadata = async () => {
        const duration = videoElement.duration;
        const frames = [];
        const interval = 0.5;

        for (let t = 0.2; t < duration - 0.2; t += interval) {
          videoElement.currentTime = t;
          await new Promise(r => {
            videoElement.onseeked = r;
          });

          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = videoElement.videoWidth;
          frameCanvas.height = videoElement.videoHeight;
          const fCtx = frameCanvas.getContext('2d');
          fCtx.drawImage(videoElement, 0, 0);

          const img = new Image();
          await new Promise(r => {
            img.onload = r;
            img.src = frameCanvas.toDataURL('image/png');
          });

          frames.push(img);
        }

        URL.revokeObjectURL(url);
        resolve(frames);
      };

      videoElement.onerror = (e) => {
        reject('동영상 로드 실패');
      };
    });
  }
};
