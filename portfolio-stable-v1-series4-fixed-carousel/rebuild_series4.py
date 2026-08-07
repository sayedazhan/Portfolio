from pathlib import Path
import re, html, zipfile

root=Path('/mnt/data/series4_rebuild')
out=Path('/mnt/data/portfolio-stable-v1-series4-fixed-carousel.zip')

titles=[
'Build an AI Email Assistant','Meeting Notes to Actions Agent','Document Q&A Assistant','AI Research Assistant','Automated Reporting Agent','Power BI + AI Workflow','AI Data Analyst','Multi-Agent Business Workflow','AI Knowledge Assistant','End-to-End AI Automation System']
descs=[
'Build an assistant that helps triage, summarize and draft email responses more efficiently.',
'Turn meeting notes into structured decisions, actions, owners and follow-up tasks.',
'Create a practical assistant that answers questions from documents and knowledge sources.',
'Build an AI research workflow that gathers, structures and summarizes useful information.',
'Automate recurring reporting workflows and turn raw information into clear business updates.',
'Connect Power BI and AI concepts into a practical workflow for analysis and decision support.',
'Build an AI-powered data analyst workflow for asking questions, exploring data and explaining insights.',
'Design a coordinated workflow where multiple AI agents collaborate on a business process.',
'Create an AI knowledge assistant that helps people find and understand trusted information.',
'Bring the series together in an end-to-end automation solution from trigger to action and outcome.']
raw='https://raw.githubusercontent.com/sayedazhan/AI-Automation-Lab/main/AI%20Automation%20Lab'
blob='https://github.com/sayedazhan/AI-Automation-Lab/blob/main/AI%20Automation%20Lab'

# 1) Upgrade episode.js to support PDF sources while preserving all older series.
epjs=root/'episode.js'
js=epjs.read_text(encoding='utf-8')
if 'async function renderPdfPages' not in js:
    js=js.replace('  let current = 1;\n  const count = data.count || 10;', '''  let current = 1;\n  const count = data.count || 10;\n  let renderedSlides = null;\n\n  async function ensurePdfJs() {\n    if (window.pdfjsLib) return window.pdfjsLib;\n    await new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";\n      script.onload = resolve;\n      script.onerror = () => reject(new Error("Could not load PDF renderer"));\n      document.head.appendChild(script);\n    });\n    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";\n    return window.pdfjsLib;\n  }\n\n  async function renderPdfPages(url, expectedCount) {\n    const pdfjs = await ensurePdfJs();\n    const task = pdfjs.getDocument({ url });\n    const pdf = await task.promise;\n    const total = Math.min(expectedCount || pdf.numPages, pdf.numPages);\n    const urls = [];\n\n    for (let number = 1; number <= total; number += 1) {\n      const page = await pdf.getPage(number);\n      const baseViewport = page.getViewport({ scale: 1 });\n      const targetWidth = Math.min(1500, Math.max(1050, Math.round(baseViewport.width * 1.8)));\n      const scale = targetWidth / baseViewport.width;\n      const viewport = page.getViewport({ scale });\n      const canvas = document.createElement("canvas");\n      canvas.width = Math.round(viewport.width);\n      canvas.height = Math.round(viewport.height);\n      const context = canvas.getContext("2d", { alpha: false });\n      context.fillStyle = "#ffffff";\n      context.fillRect(0, 0, canvas.width, canvas.height);\n      await page.render({ canvasContext: context, viewport }).promise;\n      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));\n      urls.push(URL.createObjectURL(blob));\n    }\n    return urls;\n  }''')
    js=js.replace('  function slideUrl(number) {\n    return `${data.base}/${number}.png`;\n  }', '''  function slideUrl(number) {\n    if (renderedSlides) return renderedSlides[number - 1];\n    return `${data.base}/${number}.png`;\n  }''')
    js=js.replace('  show(1);\n});', '''  async function initializeSlides() {\n    if (data.pdfUrl) {\n      const carousel = document.querySelector(".carousel");\n      const status = document.querySelector("#pdfRenderStatus");\n      try {\n        carousel?.classList.add("pdf-rendering");\n        renderedSlides = await renderPdfPages(data.pdfUrl, count);\n        const cover = document.querySelector("[data-episode-cover]");\n        if (cover && renderedSlides[0]) cover.src = renderedSlides[0];\n        thumbs.forEach((thumb, index) => {\n          const img = thumb.querySelector("img");\n          if (img && renderedSlides[index]) img.src = renderedSlides[index];\n        });\n        if (status) status.textContent = "10 PDF pages loaded as slides";\n        carousel?.classList.remove("pdf-rendering");\n        carousel?.classList.add("pdf-ready");\n      } catch (error) {\n        console.error("PDF rendering failed", error);\n        if (status) status.textContent = "The slide renderer could not load this PDF. Use the Download PDF button below.";\n        carousel?.classList.remove("pdf-rendering");\n        carousel?.classList.add("pdf-error");\n        const fallback = document.querySelector("#pdfFallbackLink");\n        fallback?.classList.add("show");\n        return;\n      }\n    }\n    show(1);\n  }\n\n  initializeSlides();\n});''')
    epjs.write_text(js,encoding='utf-8')

# 2) PDF thumbnail renderer for series page.
thumbjs=root/'assets/pdf-thumbnails.js'
thumbjs.write_text(r'''document.addEventListener("DOMContentLoaded", async () => {
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
''',encoding='utf-8')

# 3) CSS overrides: real previews, no generic brown placeholders, carousel loading state.
lh=root/'learning-hub.css'
css=lh.read_text(encoding='utf-8')
css += r'''
/* Series 4 PDF page previews */
.pdf-art{position:relative;display:flex!important;align-items:center;justify-content:center;overflow:hidden;background:#071a39!important}
.pdf-art:before{content:"Loading cover..."!important;position:absolute!important;inset:auto!important;color:#dbe8ff!important;font-size:12px!important;font-weight:800!important;letter-spacing:.04em!important;z-index:1}
.pdf-art .pdf-label{display:none!important}
.pdf-art .pdf-page-preview{position:absolute;inset:0;margin:auto;z-index:2;display:block;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#fff}
.pdf-art.pdf-ready:before{display:none!important}
.pdf-art .episode-no{z-index:4}
.pdf-art.pdf-error:before{content:"Open episode to view PDF"!important}
'''
lh.write_text(css,encoding='utf-8')

epcss=root/'episode.css'
css=epcss.read_text(encoding='utf-8')
css += r'''
/* Series 4 PDF-to-slide carousel */
.pdf-cover.cover{background:#071a39;position:relative;overflow:hidden;min-height:260px;display:flex;align-items:center;justify-content:center}
.pdf-cover.cover:before{content:"Loading PDF cover...";position:absolute;color:#dbe8ff;font-size:12px;font-weight:800}
.pdf-cover.cover img{position:relative;z-index:2;width:100%;height:100%;object-fit:contain;background:#fff}
.carousel.pdf-rendering .slide-view{min-height:420px;display:grid;place-items:center;background:#f3f6fb}
.carousel.pdf-rendering .slide-view:before{content:"Rendering PDF pages...";position:absolute;z-index:1;color:#52627a;font-size:13px;font-weight:800}
.carousel.pdf-rendering #mainSlide{opacity:0}
.carousel.pdf-ready #mainSlide{opacity:1}
.pdf-render-status{margin:8px 0 0!important;text-align:center;font-size:11px!important;color:#718096!important}
.pdf-direct-fallback{display:none;text-align:center;margin-top:14px}
.pdf-direct-fallback.show{display:block}
@media(max-width:620px){.carousel.pdf-rendering .slide-view{min-height:280px}.pdf-cover.cover{min-height:220px}}
'''
epcss.write_text(css,encoding='utf-8')

# 4) Rebuild Series 4 landing page cards with actual PDF page 1 rendered at runtime.
series=root/'ai-automation-lab.html'
s=series.read_text(encoding='utf-8')
cards=[]
for i,(title,desc) in enumerate(zip(titles,descs),1):
    pdf=f'{raw}/EP{i}.pdf'
    cards.append(f'''<a class="episode-card" href="automation-lab-episode-{i}.html"><div class="episode-art pdf-art" data-pdf="{pdf}"><span class="episode-no">EPISODE {i} OF 10</span></div><div class="episode-body"><h3>{html.escape(title)}</h3><p>{html.escape(desc)}</p><span class="episode-link">Open episode →</span></div></a>''')
s=re.sub(r'<div class="episode-grid">.*?</div></div></section>', '<div class="episode-grid">'+''.join(cards)+'</div></div></section>', s, flags=re.S)
if 'assets/pdf-thumbnails.js' not in s:
    s=s.replace('<script defer src="assets/site-nav.js"></script>', '<script defer src="assets/pdf-thumbnails.js"></script><script defer src="assets/site-nav.js"></script>')
series.write_text(s,encoding='utf-8')

# 5) Rebuild each episode to use same carousel pattern as Series 1-3.
for i,(title,desc) in enumerate(zip(titles,descs),1):
    pdf=f'{raw}/EP{i}.pdf'
    source=f'{blob}/EP{i}.pdf'
    steps=''.join(f'<a class="step{" active" if j==i else ""}" href="automation-lab-episode-{j}.html"><i>{j}</i>{html.escape(t)}</a>' for j,t in enumerate(titles,1))
    thumbs=''.join(f'<button aria-label="Open page {j}" class="thumb{" active" if j==1 else ""}"><img alt="Page {j} thumbnail" loading="lazy"/></button>' for j in range(1,11))
    prev='<span class="disabled">← Beginning of series</span>' if i==1 else f'<a href="automation-lab-episode-{i-1}.html">← Episode {i-1} · {html.escape(titles[i-2])}</a>'
    nxt='<span class="disabled">End of series ✓</span>' if i==10 else f'<a href="automation-lab-episode-{i+1}.html">Episode {i+1} · {html.escape(titles[i])} →</a>'
    page=f'''<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"/><title>{html.escape(title)} | AI Automation Lab</title><meta name="description" content="{html.escape(desc)}"/><link href="episode.css" rel="stylesheet"/><link href="assets/share-tools.css" rel="stylesheet"/><link href="https://syedazhan.netlify.app/automation-lab-episode-{i}.html" rel="canonical"/><meta name="robots" content="index,follow"/><meta property="og:type" content="website"/><meta property="og:title" content="{html.escape(title)} | AI Automation Lab"/><meta property="og:description" content="{html.escape(desc)}"/><meta property="og:url" content="https://syedazhan.netlify.app/automation-lab-episode-{i}.html"/><meta name="twitter:card" content="summary_large_image"/></head><body>
<header><div class="container nav"><a class="brand" href="index.html">AH · SYED AZHAN HASSAN</a><div style="display:flex;gap:18px;align-items:center"><a class="back" href="learning.html">Learning Hub</a><a class="back" href="ai-automation-lab.html">← Back to AI Automation Lab</a></div></div></header>
<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">AI Automation Lab · Episode {i} of 10</div><h1>{html.escape(title)}</h1><p>{html.escape(desc)}</p><div class="meta"><span>▣ 10 slides</span><span>◷ Practical PDF lesson</span><span>✓ Free learning series</span></div></div><div class="cover pdf-cover"><img data-episode-cover alt="{html.escape(title)} cover"/></div></div><div class="container episode-progress" aria-label="Series progress"><div class="progress-copy"><span>AI Automation Lab</span><strong>Episode {i} of 10 · {i*10}% through series</strong></div><div class="progress-track"><span style="width:{i*10}%"></span></div></div></section>
<main class="container layout"><aside class="side"><h3>Learning Journey</h3>{steps}</aside><section class="content"><article class="card"><h2>What you will learn</h2><p>{html.escape(desc)}</p><div class="takeaways"><div class="takeaway">Business problem</div><div class="takeaway">Automation workflow</div><div class="takeaway">AI role</div><div class="takeaway">Tools and integration</div><div class="takeaway">Practical implementation</div><div class="takeaway">Production considerations</div></div></article>
<article class="card carousel pdf-rendering"><h2>Episode carousel</h2><div class="slide-view"><img alt="Loading page 1 of {html.escape(title)}" id="mainSlide"/></div><div class="carousel-controls"><button aria-label="Previous slide" class="circle-btn" id="prevSlide">←</button><span class="counter" id="slideCounter">Preparing 10 PDF pages...</span><button aria-label="Next slide" class="circle-btn" id="nextSlide">→</button></div><div class="thumbs">{thumbs}</div><p class="pdf-render-status" id="pdfRenderStatus">Rendering the PDF into the slide viewer...</p><div class="pdf-direct-fallback" id="pdfFallbackLink"><a class="btn" href="{pdf}" target="_blank" rel="noopener">Open PDF directly →</a></div></article>
<div class="actions"><article class="action"><b>Download original PDF</b><p>Keep the complete 10-page episode for offline reading.</p><a class="btn" href="{pdf}" rel="noopener" target="_blank">Download / open PDF</a></article><article class="action"><b>Original source</b><p>The episode PDF is maintained in the public AI Automation Lab repository.</p><a class="btn secondary" href="{source}" rel="noopener" target="_blank">View source PDF</a></article></div><div class="series-return"><div><span>Learning path</span><strong>AI Automation Lab</strong></div><a href="ai-automation-lab.html">View all 10 episodes →</a></div><div class="bottom-nav">{prev}{nxt}</div></section></main>
<footer><div class="container footer-row"><div><strong>Syed Azhan Hassan</strong> · Data Analyst · AI &amp; Automation · Educator</div><div>© 2026 Syed Azhan Hassan</div></div></footer><script>window.EPISODE_DATA={{pdfUrl:{pdf!r},title:{title!r},count:10,pdf:true}};</script><script src="episode.js"></script><script defer src="assets/share-tools.js"></script></body></html>'''
    (root/f'automation-lab-episode-{i}.html').write_text(page,encoding='utf-8')

# 6) QA local references.
missing=[]
attr=re.compile(r'(?:href|src)=["\']([^"\']+)["\']',re.I)
for f in root.glob('*.html'):
    text=f.read_text(encoding='utf-8')
    for ref in attr.findall(text):
        if ref.startswith(('#','http://','https://','mailto:','tel:','javascript:','data:')): continue
        clean=ref.split('#')[0].split('?')[0]
        if clean and not (root/clean).exists(): missing.append(f'{f.name} -> {clean}')

(root/'SERIES-4-FIXED-CAROUSEL.md').write_text('''# Series 4 - Fixed Carousel Build\n\n- Removed the blocked Google PDF embed.\n- Series landing page now renders the real first PDF page as each episode cover using PDF.js.\n- Each episode renders all 10 PDF pages into the existing slide carousel.\n- Fullscreen zoom, previous/next, thumbnail navigation, sharing and PDF downloads are retained.\n- Existing Series 1-3 behavior remains unchanged.\n- PDF files stay in the GitHub repository and are fetched directly by the browser.\n''',encoding='utf-8')

if out.exists(): out.unlink()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(root))
print('Missing local refs:',len(missing))
for x in missing[:20]:print(x)
print(out, out.stat().st_size)
