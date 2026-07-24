/**
 * Shottr Web - Canvas Editor Engine (js/canvas-editor.js)
 * 버그 수정: loadImage 시 메인 화면 Canvas(this.canvas)에 합성 이미지를 직접 그려주도록 보완
 */

class CanvasEditor {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    // 원본 베이스 이미지 Canvas (배경)
    this.baseCanvas = null;
    
    // 상태 및 도구
    this.currentTool = 'select'; // select, arrow, step, mosaic, text, ruler, colorpicker, ocr
    this.currentColor = '#3B82F6';
    this.stepCounter = 1;
    
    // 히스토리 스택 (Undo 지원)
    this.historyStack = [];
    
    // 인터랙션 드래그 상태
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;

    // 이벤트 리스너 바인딩
    this.initEvents();
  }

  /**
   * 베이스 이미지 로드 및 캔버스 초기화 (버그 완전 수정!)
   */
  loadImage(sourceCanvas) {
    if (!sourceCanvas) return;

    // 1. 오프스크린 베이스 캔버스 복사
    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = sourceCanvas.width;
    this.baseCanvas.height = sourceCanvas.height;
    const baseCtx = this.baseCanvas.getContext('2d');
    baseCtx.drawImage(sourceCanvas, 0, 0);

    // 2. 화면에 실제 표시되는 메인 Canvas 크기 설정 및 이미지 직접 그리기
    this.canvas.width = sourceCanvas.width;
    this.canvas.height = sourceCanvas.height;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(sourceCanvas, 0, 0);

    // 3. 히스토리 초기 상태 저장 및 렌더링
    this.historyStack = [];
    this.saveState();
    this.render();
  }

  saveState() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.canvas, 0, 0);
    this.historyStack.push(tempCanvas);

    if (this.historyStack.length > 25) {
      this.historyStack.shift();
    }
  }

  undo() {
    if (this.historyStack.length > 1) {
      this.historyStack.pop(); // 현재 상태 버림
      const prevState = this.historyStack[this.historyStack.length - 1];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(prevState, 0, 0);
      
      // 마커 카운터 조절
      if (this.stepCounter > 1) this.stepCounter--;
    }
  }

  render() {
    if (this.historyStack.length > 0) {
      const currentState = this.historyStack[this.historyStack.length - 1];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(currentState, 0, 0);
    }
  }

  initEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      if (this.currentTool === 'select') return;
      e.preventDefault();
      const pos = getPos(e);
      this.isDrawing = true;
      this.startX = pos.x;
      this.startY = pos.y;
      this.currentX = pos.x;
      this.currentY = pos.y;

      if (this.currentTool === 'step') {
        this.drawStepMarker(pos.x, pos.y);
        this.saveState();
        this.isDrawing = false;
      } else if (this.currentTool === 'colorpicker') {
        this.pickColor(pos.x, pos.y);
        this.isDrawing = false;
      }
    };

    const moveDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.currentX = pos.x;
      this.currentY = pos.y;

      // 실시간 미리보기 렌더링
      this.render();
      this.drawPreview(this.startX, this.startY, this.currentX, this.currentY);
    };

    const endDraw = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      // 최종 상태 그리기 확정 및 히스토리 저장
      this.render();
      this.drawFinal(this.startX, this.startY, this.currentX, this.currentY);
      this.saveState();
    };

    // 마우스 & 터치 이벤트 등록
    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', moveDraw);
    this.canvas.addEventListener('mouseup', endDraw);

    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', moveDraw, { passive: false });
    this.canvas.addEventListener('touchend', endDraw);
  }

  drawPreview(x1, y1, x2, y2) {
    this.ctx.save();
    switch (this.currentTool) {
      case 'arrow':
        this.drawArrow(x1, y1, x2, y2, this.currentColor, 6);
        break;
      case 'mosaic':
        this.ctx.strokeStyle = '#3B82F6';
        this.ctx.setLineDash([6, 6]);
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        break;
      case 'ruler':
        this.drawRuler(x1, y1, x2, y2);
        break;
    }
    this.ctx.restore();
  }

  drawFinal(x1, y1, x2, y2) {
    switch (this.currentTool) {
      case 'arrow':
        this.drawArrow(x1, y1, x2, y2, this.currentColor, 6);
        break;
      case 'mosaic':
        this.applyMosaic(x1, y1, x2 - x1, y2 - y1);
        break;
      case 'text':
        this.addTextInput(x2, y2);
        break;
      case 'ruler':
        this.drawRuler(x1, y1, x2, y2);
        break;
    }
  }

  drawArrow(fromX, fromY, toX, toY, color, width) {
    const headlen = 20;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  drawStepMarker(x, y) {
    const radius = 18;
    this.ctx.save();
    
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetY = 4;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = this.currentColor;
    this.ctx.fill();

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.stroke();

    this.ctx.shadowColor = 'transparent';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 16px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.stepCounter.toString(), x, y);

    this.ctx.restore();
    this.stepCounter++;
  }

  applyMosaic(x, y, w, h) {
    if (Math.abs(w) < 5 || Math.abs(h) < 5) return;
    const realX = Math.min(x, x + w);
    const realY = Math.min(y, y + h);
    const realW = Math.abs(w);
    const realH = Math.abs(h);

    const blockPixelSize = 12;

    const imgData = this.ctx.getImageData(realX, realY, realW, realH);
    const data = imgData.data;

    for (let r = 0; r < realH; r += blockPixelSize) {
      for (let c = 0; c < realW; c += blockPixelSize) {
        const pixelIdx = (r * realW + c) * 4;
        const red = data[pixelIdx];
        const green = data[pixelIdx + 1];
        const blue = data[pixelIdx + 2];

        for (let bh = 0; bh < blockPixelSize && (r + bh) < realH; bh++) {
          for (let bw = 0; bw < blockPixelSize && (c + bw) < realW; bw++) {
            const curIdx = ((r + bh) * realW + (c + bw)) * 4;
            data[curIdx] = red;
            data[curIdx + 1] = green;
            data[curIdx + 2] = blue;
          }
        }
      }
    }

    this.ctx.putImageData(imgData, realX, realY);
  }

  drawRuler(x1, y1, x2, y2) {
    const dx = Math.round(x2 - x1);
    const dy = Math.round(y2 - y1);
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

    this.ctx.save();
    this.ctx.strokeStyle = '#EF4444';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const labelText = `${dist}px (w:${Math.abs(dx)}, h:${Math.abs(dy)})`;

    this.ctx.font = 'bold 13px Inter, sans-serif';
    const textWidth = this.ctx.measureText(labelText).width;

    this.ctx.fillStyle = 'rgba(13, 14, 17, 0.85)';
    this.ctx.fillRect(midX - textWidth / 2 - 8, midY - 14, textWidth + 16, 24);

    this.ctx.fillStyle = '#F59E0B';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(labelText, midX, midY);

    this.ctx.restore();
  }

  pickColor(x, y) {
    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1).toUpperCase();
    
    if (window.showToast) {
      window.showToast(`🎨 색상 추출됨: ${hex} (클립보드 복사 완료)`);
    }

    navigator.clipboard.writeText(hex).catch(() => {});
  }

  addTextInput(x, y) {
    const text = prompt('추가할 텍스트를 입력하세요:');
    if (!text) return;

    this.ctx.save();
    this.ctx.font = 'bold 20px Inter, sans-serif';
    const textMetrics = this.ctx.measureText(text);

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(x - 6, y - 22, textMetrics.width + 12, 30);

    this.ctx.fillStyle = this.currentColor;
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }
}
