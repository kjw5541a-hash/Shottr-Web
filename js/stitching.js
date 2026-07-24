/**
 * Shottr Web - Auto Stitching Engine (js/stitching.js)
 * 연속 스크린샷 픽셀 MAD(Mean Absolute Difference) 비교 기반 자동 스티칭 모듈
 */

const StitchEngine = {
  /**
   * 이미지 배열을 받아서 하나의 긴 통 이미지 Canvas로 자동 합성
   * @param {HTMLImageElement[]} images 
   * @param {number} manualOverlap (옵션) 수동 미세조정 겹침 픽셀 오프셋
   * @returns {HTMLCanvasElement} 합성 완료된 Canvas
   */
  stitchImages(images, manualOverlap = null) {
    if (!images || images.length === 0) return null;
    if (images.length === 1) {
      const singleCanvas = document.createElement('canvas');
      singleCanvas.width = images[0].naturalWidth || images[0].width;
      singleCanvas.height = images[0].naturalHeight || images[0].height;
      const ctx = singleCanvas.getContext('2d');
      ctx.drawImage(images[0], 0, 0);
      return singleCanvas;
    }

    // 1. 이미지 표준 너비 통일 (첫 번째 이미지 기준)
    const targetWidth = images[0].naturalWidth || images[0].width;
    const scaledHeights = [];
    const normalizedImages = [];

    images.forEach(img => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const scale = targetWidth / origW;
      const h = Math.round(origH * scale);
      scaledHeights.push(h);

      // 리사이즈된 이미지 데이터 캔버스 생성
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0, targetWidth, h);
      normalizedImages.push(tempCanvas);
    });

    // 2. 겹침 영역(Offsets) 계산
    const offsets = [0]; // 각 이미지가 그려질 Y 좌표 (0번째는 Y=0)

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

    // 3. 전체 Canvas 크기 계산 및 최종 그리기
    const totalHeight = offsets[offsets.length - 1] + scaledHeights[scaledHeights.length - 1];
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = targetWidth;
    resultCanvas.height = totalHeight;
    const ctx = resultCanvas.getContext('2d');

    // 배경을 깔끔한 다크/투명 처리 후 렌더링
    ctx.fillStyle = '#0D0E11';
    ctx.fillRect(0, 0, targetWidth, totalHeight);

    normalizedImages.forEach((imgCanvas, idx) => {
      ctx.drawImage(imgCanvas, 0, offsets[idx]);
    });

    return resultCanvas;
  },

  /**
   * 두 이미지 간의 겹치는 최적의 Y 오프셋(높이) 탐지 알고리즘
   */
  findBestOverlap(topCtx, botCtx, width, topH, botH) {
    // 하단 40% 영역 샘플링
    const sampleSearchRange = Math.min(Math.floor(topH * 0.45), botH);
    const minOverlap = 30; // 최소 겹침 픽셀

    // 픽셀 샘플링 속도 향상을 위한 스케일 다운 (가로 120px 기준 샘플링)
    const sampleW = 120;
    const stepX = Math.max(1, Math.floor(width / sampleW));

    const topData = topCtx.getImageData(0, topH - sampleSearchRange, width, sampleSearchRange).data;
    const botData = botCtx.getImageData(0, 0, width, sampleSearchRange).data;

    let minDiff = Infinity;
    let bestOverlap = 100; // 기본값

    // Y축 스캔 (5px 단위 고속 스캔 후 1px 정밀 탐지)
    for (let overlap = minOverlap; overlap < sampleSearchRange; overlap += 2) {
      let diff = 0;
      let sampleCount = 0;

      // 겹치는 행(Row) 비교
      const topStartRow = sampleSearchRange - overlap;
      const botStartRow = 0;

      for (let r = 0; r < overlap; r += 2) {
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
  }
};
