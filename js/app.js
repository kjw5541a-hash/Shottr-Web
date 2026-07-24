/**
 * Shottr Web - Main Coordinator Application (js/app.js)
 * 첨부 사진 순서 확인/조정 패널 & 스티칭 결과 렌더링 지원
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const imageLoader = document.getElementById('imageLoader');
  const hiddenVideo = document.getElementById('hiddenVideo');
  const exportBtn = document.getElementById('exportBtn');
  const emptyState = document.getElementById('emptyState');
  const canvasViewport = document.getElementById('canvasViewport');
  const canvas = document.getElementById('mainCanvas');
  const toolbar = document.getElementById('toolbar');
  const colorPickerInput = document.getElementById('colorPickerInput');
  const undoBtn = document.getElementById('undoBtn');
  const toast = document.getElementById('toast');

  // Image Manager Panel Elements
  const imageManagerPanel = document.getElementById('imageManagerPanel');
  const thumbnailList = document.getElementById('thumbnailList');
  const photoCountText = document.getElementById('photoCountText');
  const startStitchActionBtn = document.getElementById('startStitchActionBtn');
  const backToManagerBtn = document.getElementById('backToManagerBtn');

  // Stitch Adjust UI
  const stitchAdjustBar = document.getElementById('stitchAdjustBar');
  const overlapSlider = document.getElementById('overlapSlider');
  const overlapValue = document.getElementById('overlapValue');
  const stitchBtn = document.getElementById('stitchBtn');

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
      showToast('🎬 동영상에서 프레임을 추출하고 있습니다...');
      try {
        const extractedFrames = await StitchEngine.extractFramesFromVideo(firstFile, hiddenVideo);
        if (extractedFrames && extractedFrames.length > 0) {
          loadedImageElements = [...loadedImageElements, ...extractedFrames];
          showToast(`✅ ${extractedFrames.length}개 프레임 추출 완료! 순서를 확인해 주세요.`);
          showImageManager();
        } else {
          showToast('❌ 동영상에서 프레임을 추출하지 못했습니다.');
        }
      } catch (err) {
        showToast('❌ 동영상 처리 중 오류가 발생했습니다.');
        console.error(err);
      }
      return;
    }

    // 📷 B. 이미지 파일 로드
    loadImages(files);
  }

  function loadImages(files) {
    let loadedCount = 0;
    const newImages = [];

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          newImages[index] = img;
          loadedCount++;
          if (loadedCount === files.length) {
            loadedImageElements = [...loadedImageElements, ...newImages];
            showImageManager();
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 2. Image Preview & Reorder Manager Panel
  function showImageManager() {
    emptyState.style.display = 'none';
    canvasViewport.style.display = 'none';
    toolbar.style.display = 'none';
    stitchAdjustBar.style.display = 'none';
    exportBtn.style.display = 'none';

    imageManagerPanel.style.display = 'flex';
    renderThumbnailList();
  }

  function renderThumbnailList() {
    photoCountText.textContent = loadedImageElements.length;
    thumbnailList.innerHTML = '';

    if (loadedImageElements.length === 0) {
      imageManagerPanel.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    loadedImageElements.forEach((img, idx) => {
      const card = document.createElement('div');
      card.className = 'thumb-card';

      card.innerHTML = `
        <div class="thumb-order-badge">${idx + 1}</div>
        <img class="thumb-preview-img" src="${img.src}" alt="Screenshot ${idx + 1}">
        <div class="thumb-info">
          <div class="thumb-title">캡처 사진 #${idx + 1}</div>
          <div class="thumb-sub">${img.naturalWidth || img.width} x ${img.naturalHeight || img.height}px</div>
        </div>
        <div class="thumb-actions">
          <button class="icon-control-btn btn-up" title="위로 이동" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
          <button class="icon-control-btn btn-down" title="아래로 이동" ${idx === loadedImageElements.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
          <button class="icon-control-btn danger btn-del" title="삭제">🗑️</button>
        </div>
      `;

      // Event listeners for reordering & deletion
      const btnUp = card.querySelector('.btn-up');
      const btnDown = card.querySelector('.btn-down');
      const btnDel = card.querySelector('.btn-del');

      if (idx > 0) {
        btnUp.addEventListener('click', () => {
          const temp = loadedImageElements[idx];
          loadedImageElements[idx] = loadedImageElements[idx - 1];
          loadedImageElements[idx - 1] = temp;
          renderThumbnailList();
        });
      }

      if (idx < loadedImageElements.length - 1) {
        btnDown.addEventListener('click', () => {
          const temp = loadedImageElements[idx];
          loadedImageElements[idx] = loadedImageElements[idx + 1];
          loadedImageElements[idx + 1] = temp;
          renderThumbnailList();
        });
      }

      btnDel.addEventListener('click', () => {
        loadedImageElements.splice(idx, 1);
        renderThumbnailList();
      });

      thumbnailList.appendChild(card);
    });
  }

  // 3. Start Stitching & Render Result on Canvas
  startStitchActionBtn.addEventListener('click', () => {
    if (loadedImageElements.length === 0) return;
    performStitch();
  });

  backToManagerBtn.addEventListener('click', () => {
    showImageManager();
  });

  function performStitch(manualOverlap = null) {
    showToast('🧩 스티칭 합성 렌더링 중...');
    
    // UI 전환
    imageManagerPanel.style.display = 'none';
    emptyState.style.display = 'none';
    canvasViewport.style.display = 'flex';
    toolbar.style.display = 'flex';
    exportBtn.style.display = 'inline-flex';

    if (loadedImageElements.length > 1) {
      stitchAdjustBar.style.display = 'flex';
    } else {
      stitchAdjustBar.style.display = 'none';
    }

    setTimeout(() => {
      const stitchedCanvas = StitchEngine.stitchImages(loadedImageElements, manualOverlap);
      if (stitchedCanvas) {
        editor.loadImage(stitchedCanvas);
        showToast('🎉 스티칭 완벽 성공! 합성 결과를 확인하고 주석을 편집해 보세요.');
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
