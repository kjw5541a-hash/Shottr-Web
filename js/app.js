/**
 * Shottr Web - Main Coordinator Application (js/app.js)
 * 1) 파일 첨부 시 원본 그대로 위에서 아래로 붙여서 먼저 시각화 (변환금지)
 * 2) 사용자가 확인 후 [작업 진행] 버튼 클릭 시 스마트 겹침 스티칭 실행
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

  // Action Control Bar
  const actionControlBar = document.getElementById('actionControlBar');
  const openManagerBtn = document.getElementById('openManagerBtn');
  const runSmartStitchBtn = document.getElementById('runSmartStitchBtn');
  const sliderGroup = document.getElementById('sliderGroup');
  const overlapSlider = document.getElementById('overlapSlider');
  const overlapValue = document.getElementById('overlapValue');

  // Image Manager Panel Elements
  const imageManagerPanel = document.getElementById('imageManagerPanel');
  const thumbnailList = document.getElementById('thumbnailList');
  const photoCountText = document.getElementById('photoCountText');
  const confirmOrderBtn = document.getElementById('confirmOrderBtn');

  // Editor State
  const editor = new CanvasEditor(canvas);
  let loadedImageElements = [];
  let isSmartStitched = false; // 현재 겹침 스티칭 완료 여부

  // Toast Helper
  window.showToast = (msg, duration = 3500) => {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  };

  // 1. File Upload Handler
  imageLoader.addEventListener('change', handleFileUpload);

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const firstFile = files[0];

    // 동영상 파일 처리
    if (firstFile.type.startsWith('video/')) {
      showToast('🎬 동영상에서 프레임을 추출하고 있습니다...');
      try {
        const extractedFrames = await StitchEngine.extractFramesFromVideo(firstFile, hiddenVideo);
        if (extractedFrames && extractedFrames.length > 0) {
          loadedImageElements = [...loadedImageElements, ...extractedFrames];
          showToast(`✅ ${extractedFrames.length}개 프레임 추출 완료! 원본 이미지를 나열합니다.`);
          renderRawPreview();
        } else {
          showToast('❌ 동영상 프레임 추출 실패');
        }
      } catch (err) {
        showToast('❌ 동영상 처리 오류');
      }
      return;
    }

    // 이미지 파일 로드
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
            // 💡 중요: 먼저 변환하지 않고 원본 그대로 나열해서 화면에 시각화!
            renderRawPreview();
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * [1단계] 첨부된 원본 사진들을 변환 없이 위에서 아래로 그대로 붙여서 캔버스에 렌더링
   */
  function renderRawPreview() {
    if (loadedImageElements.length === 0) return;

    isSmartStitched = false;
    emptyState.style.display = 'none';
    imageManagerPanel.style.display = 'none';

    canvasViewport.style.display = 'flex';
    actionControlBar.style.display = 'flex';
    toolbar.style.display = 'flex';
    exportBtn.style.display = 'inline-flex';

    // 슬라이더 조절바 숨김 (스마트 스티칭 전)
    sliderGroup.style.display = 'none';
    runSmartStitchBtn.style.display = 'inline-flex';

    // 원본 그대로 위에서 아래로 나열한 캔버스 로드
    const rawCanvas = StitchEngine.concatImagesRaw(loadedImageElements);
    editor.loadImage(rawCanvas);

    showToast('👁️ 첨부한 원본 사진들을 위에서 아래로 붙였습니다. 확인 후 [작업 진행]을 누르세요.');
  }

  /**
   * [2단계] 사용자가 확인 후 [🚀 겹침 자동 스티칭 작업 진행] 버튼 클릭 시 비로소 변환 및 스티칭 실행!
   */
  runSmartStitchBtn.addEventListener('click', () => {
    performSmartStitch();
  });

  function performSmartStitch(manualOverlap = null) {
    showToast('🧩 겹치는 영역을 자동 탐지하여 스티칭 중...');
    
    setTimeout(() => {
      const stitchedCanvas = StitchEngine.stitchImages(loadedImageElements, manualOverlap);
      if (stitchedCanvas) {
        editor.loadImage(stitchedCanvas);
        isSmartStitched = true;
        
        // 미세조정 슬라이더 표시
        sliderGroup.style.display = 'flex';
        showToast('🎉 스티칭 작업 완료! 주석 편집 및 저장이 가능합니다.');
      } else {
        showToast('❌ 스티칭 작업 실패');
      }
    }, 60);
  }

  // 3. Image Manager (순서 카드로 보기 및 조절)
  openManagerBtn.addEventListener('click', () => {
    showImageManager();
  });

  function showImageManager() {
    emptyState.style.display = 'none';
    canvasViewport.style.display = 'none';
    actionControlBar.style.display = 'none';
    toolbar.style.display = 'none';

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
        <img class="thumb-preview-img" src="${img.src}" alt="Photo ${idx + 1}">
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

  confirmOrderBtn.addEventListener('click', () => {
    renderRawPreview();
  });

  // Slider Adjust
  overlapSlider.addEventListener('input', (e) => {
    overlapValue.textContent = `${e.target.value}px`;
    if (isSmartStitched) {
      performSmartStitch(parseInt(e.target.value, 10));
    }
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
          title: 'Shottr Web 이미지',
          text: 'Shottr Web으로 조합된 스크린샷 이미지입니다.'
        }).catch(() => {});
      } else {
        const link = document.createElement('a');
        link.download = `shottr_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('💾 사진 앨범에 저장되었습니다!');
      }
    }, 'image/png');
  });
});
