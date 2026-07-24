/**
 * Shottr Web - Main Coordinator Application (js/app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const imageLoader = document.getElementById('imageLoader');
  const stitchBtn = document.getElementById('stitchBtn');
  const exportBtn = document.getElementById('exportBtn');
  const emptyState = document.getElementById('emptyState');
  const canvasViewport = document.getElementById('canvasViewport');
  const canvas = document.getElementById('mainCanvas');
  const toolbar = document.getElementById('toolbar');
  const dropZone = document.getElementById('dropZone');
  const colorPickerInput = document.getElementById('colorPickerInput');
  const undoBtn = document.getElementById('undoBtn');
  const toast = document.getElementById('toast');

  // Stitch Adjust UI
  const stitchAdjustBar = document.getElementById('stitchAdjustBar');
  const overlapSlider = document.getElementById('overlapSlider');
  const overlapValue = document.getElementById('overlapValue');
  const applyStitchBtn = document.getElementById('applyStitchBtn');

  // OCR Modal
  const ocrBtn = document.getElementById('ocrBtn');
  const ocrModal = document.getElementById('ocrModal');
  const closeOcrModal = document.getElementById('closeOcrModal');
  const ocrResultText = document.getElementById('ocrResultText');
  const copyOcrTextBtn = document.getElementById('copyOcrTextBtn');

  // Editor State
  const editor = new CanvasEditor(canvas);
  let loadedImageElements = [];

  // Toast Notification Utility
  window.showToast = (msg, duration = 3000) => {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  };

  // 1. File Upload & Processing
  imageLoader.addEventListener('change', handleImageUpload);

  function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    loadFiles(files);
  }

  // Drag & Drop
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Clipboard Paste (Ctrl+V or Cmd+V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    const imageFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFiles.push(items[i].getAsFile());
      }
    }
    if (imageFiles.length > 0) {
      loadFiles(imageFiles);
    }
  });

  /**
   * 선택된 파일들 HTMLImageElement로 변환 로드
   */
  function loadFiles(files) {
    loadedImageElements = [];
    let loadedCount = 0;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          loadedImageElements[index] = img;
          loadedCount++;

          if (loadedCount === files.length) {
            onImagesReady();
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function onImagesReady() {
    emptyState.style.display = 'none';
    canvasViewport.style.display = 'flex';
    toolbar.style.display = 'flex';
    exportBtn.style.display = 'inline-flex';

    if (loadedImageElements.length > 1) {
      // 2장 이상인 경우 스티칭 버튼 표시 및 자동 스티칭 실행
      stitchBtn.style.display = 'inline-flex';
      stitchAdjustBar.style.display = 'flex';
      performStitch();
    } else {
      // 1장인 경우 바로 캔버스에 로드
      stitchBtn.style.display = 'none';
      stitchAdjustBar.style.display = 'none';
      editor.loadImage(StitchEngine.stitchImages(loadedImageElements));
    }
  }

  // 스티칭 실행
  function performStitch(manualOverlap = null) {
    showToast('🧩 이미지 자동 이어붙이는 중...');
    setTimeout(() => {
      const stitchedCanvas = StitchEngine.stitchImages(loadedImageElements, manualOverlap);
      if (stitchedCanvas) {
        editor.loadImage(stitchedCanvas);
        showToast('✅ 스티칭 합성 완료!');
      }
    }, 50);
  }

  // 스티칭 슬라이더 변경 이벤트
  overlapSlider.addEventListener('input', (e) => {
    overlapValue.textContent = `${e.target.value}px`;
  });

  applyStitchBtn.addEventListener('click', () => {
    const val = parseInt(overlapSlider.value, 10);
    performStitch(val);
  });

  stitchBtn.addEventListener('click', () => performStitch());

  // 2. Toolbar Tools Switching
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tool = btn.getAttribute('data-tool');
      editor.currentTool = tool;

      if (tool === 'ocr') {
        runOcr();
      }
    });
  });

  // Color Swatch Update
  colorPickerInput.addEventListener('input', (e) => {
    editor.currentColor = e.target.value;
  });

  // Undo
  undoBtn.addEventListener('click', () => {
    editor.undo();
  });

  // 3. OCR Processing
  async function runOcr() {
    showToast('🔍 텍스트 인식(OCR) 진행 중...');
    const extractedText = await OcrEngine.recognize(canvas);
    ocrResultText.value = extractedText;
    ocrModal.style.display = 'flex';
  }

  closeOcrModal.addEventListener('click', () => {
    ocrModal.style.display = 'none';
  });

  copyOcrTextBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(ocrResultText.value).then(() => {
      showToast('📋 텍스트가 클립보드에 복사되었습니다!');
      ocrModal.style.display = 'none';
    });
  });

  // 4. Export & Save (iOS Web Share / Image Download)
  exportBtn.addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;

      // iOS Native Share Sheet 지원 (사진 앱에 바로 저장 가능)
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'shottr.png', { type: 'image/png' })] })) {
        const file = new File([blob], `shottr_${Date.now()}.png`, { type: 'image/png' });
        navigator.share({
          files: [file],
          title: 'Shottr Web 캡처',
          text: 'Shottr Web으로 편집된 이미지입니다.'
        }).catch(() => {});
      } else {
        // 일반 브라우저 다운로드
        const link = document.createElement('a');
        link.download = `shottr_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('💾 이미지가 다운로드되었습니다!');
      }
    }, 'image/png');
  });

  // Service Worker Registration for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Reg Failed:', err));
  }
});
