document.addEventListener("DOMContentLoaded", async () => {
  const targets = [...document.querySelectorAll(".pdf-art[data-pdf]")];
  if (!targets.length) return;

  async function ensurePdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return window.pdfjsLib;
  }

  const pdfjs = await ensurePdfJs();
  await Promise.all(targets.map(async target => {
    try {
      const pdf = await pdfjs.getDocument({ url: target.dataset.pdf }).promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = 900 / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-preview";
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      target.prepend(canvas);
      target.classList.add("pdf-ready");
    } catch (error) {
      console.error("Thumbnail render failed", error);
      target.classList.add("pdf-error");
    }
  }));
});
