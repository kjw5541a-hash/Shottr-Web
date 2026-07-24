/**
 * Shottr Web - Auto Stitching Engine (js/stitching.js)
 * 연속 스크린샷 & 화면 녹화 동영상(Video) 기반 픽셀 스티칭 모듈 (Safari 검은화면 방지 최적화)
 */

const StitchEngine = {
  // 모바일 Safari Canvas 최대 너비 제한 (검은화면 버그 방지)
  MAX_CANVAS_WIDTH: 1080,

  /**
   * 이미지 배열 합성 실행
   */
  stitchImages(images, manualOverlap = null) {
    if (!images || images.length === 0) return null;

    if (images.length === 1) {
      const origW = images[0].naturalWidth || images[0].width;
      const origH = images[0].naturalHeight || images[0].height;
      const targetW = Math.min(origW, this.MAX_CANVAS_WIDTH);
      const scale = targetW / origW;
      const targetH = Math.round(origH * scale);

      const singleCanvas = document.createElement('canvas');
      singleCanvas.width = targetW;
      singleCanvas.height = targetH;
      const ctx = singleCanvas.getContext('2d');
      ctx.drawImage(images[0], 0, 0, targetW, targetH);
      return singleCanvas;
    }

    // 1. 모바일 캔버스 안전 너비(Max 1080px) 스케일링
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

    // 2. 겹침 영역(Offsets) 계산
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

    // 3. 전체 Canvas 크기 생성 및 Safari 안전 렌더링
    const totalHeight = offsets[offsets.length - 1] + scaledHeights[scaledHeights.length - 1];

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = targetWidth;
    resultCanvas.height = totalHeight;
    const ctx = resultCanvas.getContext('2d');

    // 검은 화면 방지 배경 투명/어두운 처리
    ctx.fillStyle = '#0D0E11';
    ctx.fillRect(0, 0, targetWidth, totalHeight);

    normalizedImages.forEach((imgCanvas, idx) => {
      ctx.drawImage(imgCanvas, 0, offsets[idx]);
    });

    return resultCanvas;
  },

  /**
   * 겹침 영역 오프셋 계산 알고리즘
   */
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

  /**
   * 🎬 [핵심 신기능] 아이폰 화면 녹화 동영상(.mov / .mp4)에서 프레임 자동 추출
   * @param {File} videoFile 
   * @param {HTMLVideoElement} videoElement 
   * @returns {Promise<HTMLImageElement[]>}
   */
  async extractFramesFromVideo(videoFile, videoElement) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(videoFile);
      videoElement.src = url;

      videoElement.onloadedmetadata = async () => {
        const duration = videoElement.duration;
        const frames = [];
        const interval = 0.5; // 0.5초마다 1프레임 캡처

        for (let t = 0.2; t < duration - 0.2; t += interval) {
          videoElement.currentTime = t;
          await new Promise(r => {
            videoElement.onseeked = r;
          });

          // 캔버스에 프레임 캡처
          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = videoElement.videoWidth;
          frameCanvas.height = videoElement.videoHeight;
          const fCtx = frameCanvas.getContext('2d');
          fCtx.drawImage(videoElement, 0, 0);

          // Image 객체 변환
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
