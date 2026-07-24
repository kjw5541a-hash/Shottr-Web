/**
 * Shottr Web - OCR Engine Module (js/ocr.js)
 * Tesseract.js 기반 온디바이스 텍스트 추출 및 인식 모듈
 */

const OcrEngine = {
  worker: null,
  isInitializing: false,

  /**
   * Tesseract 비동기 OCR 워커 준비
   */
  async init() {
    if (this.worker || this.isInitializing) return;
    this.isInitializing = true;
    try {
      if (typeof Tesseract !== 'undefined') {
        this.worker = await Tesseract.createWorker('kor+eng');
      }
    } catch (e) {
      console.warn('OCR Worker Init Failed:', e);
    } finally {
      this.isInitializing = false;
    }
  },

  /**
   * 캔버스 영역에서 텍스트 추출 실행
   * @param {HTMLCanvasElement} canvas 
   * @returns {Promise<string>} 인식된 텍스트
   */
  async recognize(canvas) {
    if (!this.worker) {
      await this.init();
    }

    if (!this.worker) {
      // CDN 로드 실패 시 가벼운 폴백
      return "Tesseract.js OCR 엔진을 초기화하는 중입니다. 인터넷 연결을 확인해주세요.";
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const ret = await this.worker.recognize(dataUrl);
      return ret.data.text.trim();
    } catch (err) {
      console.error('OCR Recognition Error:', err);
      return "텍스트 추출 중 오류가 발생했습니다.";
    }
  }
};
