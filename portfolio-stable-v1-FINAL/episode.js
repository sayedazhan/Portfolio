document.addEventListener("DOMContentLoaded", () => {
  const data = window.EPISODE_DATA;
  if (!data) return;

  let current = 1;
  const count = data.count || 10;
  const main = document.querySelector("#mainSlide");
  const counter = document.querySelector("#slideCounter");
  const thumbs = [...document.querySelectorAll(".thumb")];

  function slideUrl(number) {
    return `${data.base}/${number}.png`;
  }

  function show(number) {
    current = ((number - 1 + count) % count) + 1;
    main.src = slideUrl(current);
    main.alt = `Slide ${current} of ${data.title}`;
    counter.textContent = `Slide ${current} of ${count}`;
    thumbs.forEach((thumb, index) => thumb.classList.toggle("active", index === current - 1));

    if (viewer.classList.contains("open")) {
      viewerImage.src = main.src;
      viewerImage.alt = main.alt;
      viewerCounter.textContent = `Slide ${current} of ${count}`;
      resetTransform();
    }
  }

  document.querySelector("#prevSlide")?.addEventListener("click", () => show(current - 1));
  document.querySelector("#nextSlide")?.addEventListener("click", () => show(current + 1));
  thumbs.forEach((thumb, index) => thumb.addEventListener("click", () => show(index + 1)));

  main.classList.add("zoomable-slide");
  main.setAttribute("tabindex", "0");
  main.setAttribute("role", "button");
  main.setAttribute("aria-label", "Open slide in fullscreen zoom viewer");

  const hint = document.createElement("button");
  hint.className = "zoom-hint";
  hint.type = "button";
  hint.innerHTML = '<span aria-hidden="true">⌕</span> Tap to zoom';
  hint.setAttribute("aria-label", "Open slide in fullscreen zoom viewer");
  main.closest(".slide-view")?.appendChild(hint);

  const viewer = document.createElement("div");
  viewer.className = "slide-viewer";
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", "Fullscreen slide viewer");
  viewer.innerHTML = `
    <div class="viewer-toolbar">
      <span class="viewer-counter" aria-live="polite"></span>
      <div class="viewer-toolbar-actions">
        <button class="viewer-tool" type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
        <button class="viewer-tool" type="button" data-action="reset" aria-label="Reset zoom">100%</button>
        <button class="viewer-tool" type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
        <button class="viewer-close" type="button" aria-label="Close fullscreen viewer">×</button>
      </div>
    </div>
    <div class="viewer-stage">
      <img class="viewer-image" draggable="false" alt="">
    </div>
    <button class="viewer-nav viewer-prev" type="button" aria-label="Previous slide">←</button>
    <button class="viewer-nav viewer-next" type="button" aria-label="Next slide">→</button>
    <div class="viewer-help">Pinch or double-tap to zoom · Drag to move</div>
  `;
  document.body.appendChild(viewer);

  const viewerImage = viewer.querySelector(".viewer-image");
  const viewerCounter = viewer.querySelector(".viewer-counter");
  const viewerStage = viewer.querySelector(".viewer-stage");
  const resetButton = viewer.querySelector('[data-action="reset"]');

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let startX = 0;
  let startY = 0;
  let startTranslateX = 0;
  let startTranslateY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let lastTap = 0;
  const pointers = new Map();

  function clampScale(value) {
    return Math.min(5, Math.max(1, value));
  }

  function applyTransform() {
    if (scale === 1) {
      translateX = 0;
      translateY = 0;
    }
    viewerImage.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    resetButton.textContent = `${Math.round(scale * 100)}%`;
    viewerStage.classList.toggle("is-zoomed", scale > 1);
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function setScale(nextScale) {
    scale = clampScale(nextScale);
    applyTransform();
  }

  function openViewer() {
    viewerImage.src = main.src;
    viewerImage.alt = main.alt;
    viewerCounter.textContent = `Slide ${current} of ${count}`;
    viewer.classList.add("open");
    document.body.classList.add("viewer-open");
    resetTransform();
    viewer.querySelector(".viewer-close").focus();
  }

  function closeViewer() {
    viewer.classList.remove("open");
    document.body.classList.remove("viewer-open");
    resetTransform();
    main.focus({ preventScroll: true });
  }

  main.addEventListener("click", openViewer);
  main.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openViewer();
    }
  });
  hint.addEventListener("click", openViewer);

  viewer.querySelector(".viewer-close").addEventListener("click", closeViewer);
  viewer.querySelector(".viewer-prev").addEventListener("click", () => show(current - 1));
  viewer.querySelector(".viewer-next").addEventListener("click", () => show(current + 1));
  viewer.querySelector('[data-action="zoom-in"]').addEventListener("click", () => setScale(scale + 0.5));
  viewer.querySelector('[data-action="zoom-out"]').addEventListener("click", () => setScale(scale - 0.5));
  resetButton.addEventListener("click", resetTransform);

  viewer.addEventListener("click", event => {
    if (event.target === viewer) closeViewer();
  });

  viewerStage.addEventListener("wheel", event => {
    event.preventDefault();
    setScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });

  function pointerDistance() {
    const points = [...pointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  viewerStage.addEventListener("pointerdown", event => {
    viewerStage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      startX = event.clientX;
      startY = event.clientY;
      startTranslateX = translateX;
      startTranslateY = translateY;
    } else if (pointers.size === 2) {
      pinchStartDistance = pointerDistance();
      pinchStartScale = scale;
    }
  });

  viewerStage.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const distance = pointerDistance();
      if (pinchStartDistance > 0) setScale(pinchStartScale * (distance / pinchStartDistance));
    } else if (pointers.size === 1 && scale > 1) {
      translateX = startTranslateX + (event.clientX - startX);
      translateY = startTranslateY + (event.clientY - startY);
      applyTransform();
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      startX = remaining.x;
      startY = remaining.y;
      startTranslateX = translateX;
      startTranslateY = translateY;
    }
  }

  viewerStage.addEventListener("pointerup", endPointer);
  viewerStage.addEventListener("pointercancel", endPointer);

  viewerStage.addEventListener("dblclick", event => {
    event.preventDefault();
    if (scale > 1) resetTransform(); else setScale(2.5);
  });

  viewerStage.addEventListener("touchend", event => {
    if (event.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      event.preventDefault();
      if (scale > 1) resetTransform(); else setScale(2.5);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  }, { passive: false });

  document.addEventListener("keydown", event => {
    if (viewer.classList.contains("open")) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") show(current - 1);
      if (event.key === "ArrowRight") show(current + 1);
      if (event.key === "+" || event.key === "=") setScale(scale + 0.5);
      if (event.key === "-") setScale(scale - 0.5);
      return;
    }

    if (event.key === "ArrowLeft") show(current - 1);
    if (event.key === "ArrowRight") show(current + 1);
  });

  show(1);
});
