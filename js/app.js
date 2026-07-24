/**
 * Shottr Web - Main Coordinator Application (js/app.js)
 * 동영상(.mov/.mp4) 프레임 추출 지원 및 스티칭 결과 직관적 렌더링
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const imageLoader = document.getElementById('imageLoader');
  const hiddenVideo = document.getElementById('hiddenVideo');
  const stitchBtn = document.getElementById('stitchBtn');
  const exportBtn = document.getElementById('exportBtn');
  const emptyState = document.getElementById('emptyState');
  const canvasViewport = document.getElementById('canvasViewport');
  const canvas = document.getElementById('mainCanvas');
  const toolbar = document.getElementById('toolbar');
  const colorPickerInput = document.getElementById('colorPickerInput');
  const undoBtn = document.getElementById('undoBtn');
  const toast = document.getElementById('toast');

  // Stitch Adjust UI
  const stitchAdjustBar = document.getElementById('stitchAdjustBar');
  const overlapSlider = document.getElementById('overlapSlider');
  const overlapValue = document.getElementById('overlapValue');

  // OCR Modal
  const ocrModal = document.getElementById('ocrModal');
  const closeOcrModal = document.getElementById('closeOcrModal');
  const ocrResultText = document.getElementById('ocrResultText');
  const copyOcrTextBtn = document.getElementById('copyOcrTextBtn');

  // Editor State
  const editor = new CanvasEditor(canvas);
  let loadedImageElements = [];

  // Toast Helper
  window.showToast = (msg, duration = 3500) => {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  };

  // 1. File Upload Handler (Image & Video)
  imageLoader.addEventListener('change', handleFileUpload);

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const firstFile = files[0];

    // 🎬 A. 동영상 파일(.mov, .mp4)이 업로드된 경우
    if (firstFile.type.startsWith('video/')) {
      showToast('🎬 동영상에서 캡처 프레임을 추출하고 있습니다...');
      try {
        const extractedFrames = await StitchEngine.extractFramesFromVideo(firstFile, hiddenVideo);
        if (extractedFrames && extractedFrames.length > 0) {
          loadedImageElements = extractedFrames;
          showToast(`✅ ${extractedFrames.length}개 프레임 추출 완료! 자동 스티칭 중...`);
          onImagesReady();
        } else {
          showToast('❌ 동영상에서 프레임을 추출하지 못했습니다.');
        }
      } catch (err) {
        showToast('❌ 동영상 처리 중 오류가 발생했습니다.');
        console.error(err);
      }
      return;
    }

    // 📷 B. 이미지 파일 여러 장 또는 1장이 업로드된 경우
    loadImages(files);
  }

  function loadImages(files) {
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
      stitchAdjustBar.style.display = 'flex';
      performStitch();
    } else {
      stitchAdjustBar.style.display = 'none';
      editor.loadImage(StitchEngine.stitchImages(loadedImageElements));
    }
  }

  function performStitch(manualOverlap = null) {
    showToast('🧩 스티칭 합성 렌더링 중...');
    setTimeout(() => {
      const stitchedCanvas = StitchEngine.stitchImages(loadedImageElements, manualOverlap);
      if (stitchedCanvas) {
        editor.loadImage(stitchedCanvas);
        showToast('🎉 스티칭 합성 완벽 성공! 주석 편집을 시작해 보세요.');
      } else {
        showToast('❌ 스티칭 합성 실패');
      }
    }, 60);
  }

  // Adjust Bar
  overlapSlider.addEventListener('input', (e) => {
    overlapValue.textContent = `${e.target.value}px`;
  });

  stitchBtn.addEventListener('click', () => {
    const val = parseInt(overlapSlider.value, 10);
    performStitch(val);
  });

  // Tools Switching
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

  colorPickerInput.addEventListener('input', (e) => {
    editor.currentColor = e.target.value;
  });

  undoBtn.addEventListener('click', () => {
    editor.undo();
  });

  // OCR
  async function runOcr() {
    showToast('🔍 텍스트 인식(OCR) 실행 중...');
    const text = await OcrEngine.recognize(canvas);
    ocrResultText.value = text;
    ocrModal.style.display = 'flex';
  }

  closeOcrModal.addEventListener('click', () => {
    ocrModal.style.display = 'none';
  });

  copyOcrTextBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(ocrResultText.value).then(() => {
      showToast('📋 클립보드에 텍스트가 복사되었습니다!');
      ocrModal.style.display = 'none';
    });
  });

  // Export / Save
  exportBtn.addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;

      if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'shottr.png', { type: 'image/png' })] })) {
        const file = new File([blob], `shottr_${Date.now()}.png`, { type: 'image/png' });
        navigator.share({
          files: [file],
          title: 'Shottr Web 합성 이미지',
          text: 'Shottr Web으로 생성된 긴 화면 캡처 이미지입니다.'
        }).catch(() => {});
      } else {
        const link = document.createElement('a');
        link.download = `shottr_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('💾 사진 앨범에 다운로드 되었습니다!');
      }
    }, 'image/png');
  });
});
