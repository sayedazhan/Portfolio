(function(){
  'use strict';
  const PAGE = location.pathname.split('/').pop() || 'index.html';
  const SERIES = {
    'data-ai-mastery.html': {name:'AI & Data Mastery', repo:'DATA-AI-MASTERY-SERIES'},
    'ai-at-work.html': {name:'AI at Work', repo:'AI-at-Work'},
    'ai-agent-builder.html': {name:'AI Agent Builder', repo:'AI-Agent-Builder'},
    'ai-automation-lab.html': {name:'AI Automation Lab', repo:'AI-Automation-Lab'}
  };

  function slugify(value){return String(value||'download').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
  function canonicalUrl(){return document.querySelector('link[rel="canonical"]')?.href || location.href.split('#')[0];}
  function pageTitle(){return document.querySelector('h1')?.textContent?.trim() || document.title.split('|')[0].trim();}
  function setStatus(root,text){const el=root.querySelector('.share-status'); if(el){el.textContent=text; if(text)setTimeout(()=>{if(el.textContent===text)el.textContent='';},3500);}}
  async function copyText(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;} const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
  function popup(url){window.open(url,'shareWindow','width=720,height=620,noopener,noreferrer');}

  let crcTable;
  function getCrcTable(){if(crcTable)return crcTable;crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0;}return crcTable;}
  function crc32(bytes){let c=0xffffffff;const table=getCrcTable();for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function u16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
  function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
  function concat(parts){let len=0;parts.forEach(p=>len+=p.length);const out=new Uint8Array(len);let o=0;parts.forEach(p=>{out.set(p,o);o+=p.length;});return out;}
  function dosDateTime(){const d=new Date();const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);const date=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);return {time,date};}
  function buildZip(files){const enc=new TextEncoder();const locals=[],centrals=[];let offset=0;const dt=dosDateTime();for(const file of files){const name=enc.encode(file.name);const data=file.data;const crc=crc32(data);const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length;}const centralData=concat(centrals);const end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralData.length),u32(offset),u16(0)]);return new Blob([...locals,centralData,end],{type:'application/zip'});}
  async function downloadEpisode(root,button){const data=window.EPISODE_DATA;if(!data)return;const count=data.count||10;button.disabled=true;const old=button.textContent;button.textContent='Preparing ZIP…';setStatus(root,'Collecting episode slides…');try{const files=[];for(let i=1;i<=count;i++){button.textContent=`Downloading ${i}/${count}…`;const response=await fetch(`${data.base}/${i}.png`,{mode:'cors'});if(!response.ok)throw new Error(`Slide ${i} could not be downloaded`);files.push({name:`slide-${String(i).padStart(2,'0')}.png`,data:new Uint8Array(await response.arrayBuffer())});}button.textContent='Creating ZIP…';const blob=buildZip(files);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(data.title)}-slides.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setStatus(root,'Episode ZIP downloaded.');}catch(err){console.error(err);setStatus(root,'Could not create the ZIP. Use “View source slides” as a fallback.');}finally{button.disabled=false;button.textContent=old;}}
  async function downloadCurrentSlide(root){const img=document.querySelector('#mainSlide');if(!img)return;setStatus(root,'Preparing current slide…');try{const response=await fetch(img.src,{mode:'cors'});if(!response.ok)throw new Error('download failed');const blob=await response.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);const counter=document.querySelector('#slideCounter')?.textContent.match(/\d+/)?.[0]||'1';a.download=`${slugify(pageTitle())}-slide-${counter}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setStatus(root,'Slide downloaded.');}catch(err){window.open(img.src,'_blank','noopener');setStatus(root,'Opened the full-size slide. Long-press or save it from your browser.');}}

  function makeRoot(kind,series){
    const root=document.createElement('section');root.className='share-tools';
    const title=pageTitle();
    root.innerHTML=`<div class="share-tools__head"><div><h3>${kind==='episode'?'Save or share this episode':'Save or share this series'}</h3><p>${kind==='episode'?'Keep the slides for later or share this lesson with your network.':'Download the complete source collection or share the series with your network.'}</p></div></div><div class="share-tools__actions"></div><div class="social-share-menu" aria-label="Social sharing options"></div><div class="share-status" aria-live="polite"></div>`;
    const actions=root.querySelector('.share-tools__actions');
    if(kind==='episode'){
      const data=window.EPISODE_DATA||{};
      if(data.pdfUrl){
        const ep=document.createElement('a');ep.className='share-action';ep.href=data.pdfUrl;ep.target='_blank';ep.rel='noopener';ep.textContent='↓ Download episode PDF';actions.appendChild(ep);
        const open=document.createElement('a');open.className='share-action secondary';open.href=data.pdfUrl;open.target='_blank';open.rel='noopener';open.textContent='↗ Open full PDF';actions.appendChild(open);
      }else{
        const ep=document.createElement('button');ep.className='share-action';ep.type='button';ep.textContent='↓ Download episode ZIP';ep.addEventListener('click',()=>downloadEpisode(root,ep));actions.appendChild(ep);
        const slide=document.createElement('button');slide.className='share-action secondary';slide.type='button';slide.textContent='↓ Current slide';slide.addEventListener('click',()=>downloadCurrentSlide(root));actions.appendChild(slide);
      }
    } else if(series){
      const dl=document.createElement('a');dl.className='share-action';dl.href=`https://github.com/sayedazhan/${series.repo}/archive/refs/heads/main.zip`;dl.textContent='↓ Download full series ZIP';dl.setAttribute('download','');actions.appendChild(dl);
    }
    const native=document.createElement('button');native.type='button';native.className='share-action soft primary-mobile';native.textContent='↗ Share';actions.appendChild(native);
    const copy=document.createElement('button');copy.type='button';copy.className='share-action secondary';copy.textContent='⧉ Copy link';copy.addEventListener('click',async()=>{try{await copyText(canonicalUrl());setStatus(root,'Link copied to clipboard.');}catch{setStatus(root,'Could not copy automatically.');}});actions.appendChild(copy);
    const menu=root.querySelector('.social-share-menu');
    const url=()=>encodeURIComponent(canonicalUrl()); const text=()=>encodeURIComponent(`${title} — Syed Azhan Hassan`);
    const items=[
      ['WhatsApp',()=>`https://wa.me/?text=${text()}%20${url()}`],
      ['LinkedIn',()=>`https://www.linkedin.com/sharing/share-offsite/?url=${url()}`],
      ['Facebook',()=>`https://www.facebook.com/sharer/sharer.php?u=${url()}`],
      ['X',()=>`https://twitter.com/intent/tweet?text=${text()}&url=${url()}`],
      ['Email',()=>`mailto:?subject=${text()}&body=${encodeURIComponent('I thought you might find this useful: ')}${url()}`]
    ];
    items.forEach(([label,getUrl])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{const target=getUrl();if(target.startsWith('mailto:'))location.href=target;else popup(target);});menu.appendChild(b);});
    native.addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title, text:`Explore ${title} by Syed Azhan Hassan`, url:canonicalUrl()});setStatus(root,'Shared successfully.');return;}catch(err){if(err?.name==='AbortError')return;}}menu.classList.toggle('open');native.textContent=menu.classList.contains('open')?'× Close share options':'↗ Share';});
    return root;
  }

  document.addEventListener('DOMContentLoaded',()=>{
    if(window.EPISODE_DATA){const carousel=document.querySelector('.content .carousel');if(carousel)carousel.parentNode.insertBefore(makeRoot('episode'),carousel);return;}
    const series=SERIES[PAGE];if(series){const hero=document.querySelector('.series-hero');if(hero){const wrap=document.createElement('div');wrap.className='series-share-wrap';wrap.appendChild(makeRoot('series',series));hero.insertAdjacentElement('afterend',wrap);}}
  });
})();
