/* Native pagination only: no API calls, canvas hooks, or copied discussions. */
(() => {
  'use strict';
  const ROOT_CLASS='jujian-single-page';
  const LONG_CLASS='jujian-long-page';
  const FIT_CLASS='jujian-fit-width';
  const defaults={singlePageEnabled:true,singlePageWidth:900,singlePageFitWidth:true,...jujianPageCount.defaults,...jujianTypography.defaults,...jujianAppearance.defaults};
  let enabled=true,width=900,active=false,layoutTimer,ui,shadow;
  const typography={...jujianTypography.defaults};
  let typographyStyle;
  let appearance=jujianAppearance.defaults,appearanceStyle,refreshAppearance;
  let wallpaperSource='',wallpaperRatio=0;
  let textColorFilter,paintedTextColor='';
  let pageCount=jujianPageCount.fromSettings(defaults);
  let fitWidth=true;
  let lastRoot=null,lastWidth=0,lastPageCount=1;
  const boundedWidth=value=>Math.max(680,Math.min(960,Number(value)||900));
  function nativeRoot(){return document.querySelector('.wr_horizontalReader');}
  function resizeNative(){window.dispatchEvent(new Event('resize'));}
  function scheduleLayout(){
    clearTimeout(layoutTimer);
    layoutTimer=setTimeout(applyLayout,80);
  }
  function applyTypography(shouldApply){
    const declarations=jujianTypography.controls.flatMap(({key,property})=>{
      const value=typography[key] || (key==='readerLineHeight' && typography.readerFontSize ? '1.9' : '');
      return value ? [`${property}:${value}!important;`] : [];
    });
    // WeRead measures the prerendered text to position both canvas glyphs and underlines.
    const css=shouldApply&&declarations.length
      ? `html.${ROOT_CLASS} .wr_horizontalReader :is(.preRenderContent,.renderTargetContent) :is(p,li){${declarations.join('')}}`
      : '';
    if(typographyStyle.textContent===css)return false;
    typographyStyle.textContent=css;
    return true;
  }
  function applyAppearance(shouldApply){
    const wallpaper=appearance.readerWallpaper;
    if(shouldApply&&appearance.readerBackground==='wallpaper'&&wallpaper!==wallpaperSource){
      wallpaperSource=wallpaper;
      wallpaperRatio=0;
      if(wallpaper){
        const image=new Image();
        image.onload=()=>{
          if(wallpaperSource!==wallpaper)return;
          wallpaperRatio=image.naturalWidth/image.naturalHeight;
          applyAppearance(active);
        };
        image.src=wallpaper;
      }
    }
    const paper=shouldApply&&jujianAppearance.paperStyles(appearance,wallpaperRatio);
    const outer=shouldApply&&jujianAppearance.outerStyles(appearance);
    const selector=`html.${ROOT_CLASS} .wr_horizontalReader`;
    const color=shouldApply ? appearance.readerTextColor : '';
    // WeRead paints its own theme colors into the text canvas. Recolor that
    // layer's pixels while retaining their alpha and all original hit targets.
    if(color&&color!==paintedTextColor){
      if(!textColorFilter){
        textColorFilter=document.createElement('div');
        textColorFilter.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';
        textColorFilter.setAttribute('aria-hidden','true');
        document.documentElement.append(textColorFilter);
      }
      textColorFilter.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs><filter id="jujian-text-color-filter" color-interpolation-filters="sRGB"><feFlood flood-color="${color}"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs></svg>`;
      paintedTextColor=color;
    }
    const css=(paper?`${selector} .readerChapterContent{${paper}}`:'')+
      (outer?`${selector},${selector} .readerChapterContent_container{${outer}}`:'')+
      (color?`${selector} .wr_canvasContainer canvas{filter:url("#jujian-text-color-filter")!important;}
      ${selector} .renderTargetContent :is(p,li){color:${color}!important;}`:'');
    if(appearanceStyle.textContent!==css)appearanceStyle.textContent=css;
  }
  function applyLayout(){
    const root=nativeRoot(),shouldApply=enabled&&Boolean(root);
    const layoutPageCount=shouldApply?pageCount:1;
    document.documentElement.classList.toggle(ROOT_CLASS,shouldApply);
    document.documentElement.classList.toggle(LONG_CLASS,layoutPageCount>1);
    document.documentElement.classList.toggle(FIT_CLASS,shouldApply&&fitWidth);
    const viewportWidth=document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--jujian-viewport-width',`${viewportWidth}px`);
    document.documentElement.style.setProperty('--jujian-page-width',`${width}px`);
    document.documentElement.style.setProperty('--jujian-page-count',String(layoutPageCount));
    const typographyChanged=applyTypography(shouldApply);
    applyAppearance(shouldApply);
    const actualWidth=shouldApply?(document.querySelector('.wr_horizontalReader .readerChapterContent')?.clientWidth||0):0;
    if(typographyChanged||active!==shouldApply||lastRoot!==root||lastWidth!==actualWidth||lastPageCount!==layoutPageCount){
      if(lastPageCount>1&&lastPageCount!==layoutPageCount)resetScroll();
      active=shouldApply;lastRoot=root;lastWidth=actualWidth;
      lastPageCount=layoutPageCount;
      // Native reader measures min(html.clientWidth, body.clientWidth), then
      // repaginates into ONE column when that width is less than 1060px.
      resizeNative();
    }
    updateUI();
  }
  function resetScroll(){
    const viewport=document.scrollingElement;
    if(viewport)viewport.scrollTop=0;
  }
  function afterPagerClick(event){
    if(lastPageCount===1||!event.target.closest?.('.wr_horizontalReader .renderTarget_pager_button'))return;
    // Leave the native click and its handlers intact. Several consecutive pages
    // reuse the same canvas node, so a DOM replacement is not a navigation signal.
    requestAnimationFrame(resetScroll);
  }
  function handleReadingKey(event){
    if(lastPageCount===1||event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
    if(!['ArrowUp','ArrowDown','PageUp','PageDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    if(event.composedPath().includes(ui))return;
    const target=event.target;
    const pager=target.closest?.('.renderTarget_pager_button');
    if(!pager&&target.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="dialog"],.readerControls,.readerCatalog'))return;
    const overlay=document.querySelector('.reader_float_review_with_range_panel_wrapper .reviews_panel, [role="dialog"][aria-modal="true"]');
    if(overlay?.getClientRects().length)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      requestAnimationFrame(resetScroll);
      return;
    }
    // The site's own keydown handler turns a whole native page on these keys.
    event.preventDefault();
    event.stopImmediatePropagation();
    const step=event.key.startsWith('Page')?Math.max(80,window.innerHeight-96):48;
    window.scrollBy(0,event.key.endsWith('Up')?-step:step);
  }
  function enterPagination(){
    if(nativeRoot())return;
    // The site's own switch from scrolling to paginated reading.
    document.querySelector('.readerControls_item.isNormalReader')?.click();
  }
  async function saveEnabled(value){
    enabled=Boolean(value);
    if(enabled)enterPagination();
    applyLayout();
    try{await chrome.storage.local.set({singlePageEnabled:enabled});}catch{}
  }
  function updateUI(){
    if(!shadow)return;
    const longPage=pageCount>1;
    shadow.getElementById('fab').textContent=active?(longPage?'句间 · 长页':'句间 · 单页'):'句间 · 阅读';
    shadow.getElementById('enable').textContent=active?'恢复原生布局':'启用单页阅读';
    shadow.getElementById('status').textContent=active
      ?(longPage?'向下滚动阅读，页底可翻到下一长页。':'单屏分页阅读')
      :enabled?'等待分页阅读器；点击下方按钮切换到单页。':'已恢复微信读书原生布局。';
    shadow.getElementById('width').value=String(width);
    shadow.getElementById('fit-width').checked=fitWidth;
    shadow.getElementById('fixed-width').hidden=fitWidth;
    shadow.getElementById('page-count').value=String(pageCount);
    shadow.getElementById('width-value').textContent=`${width}px`;
    for(const {key} of jujianTypography.controls)shadow.getElementById(key).value=typography[key];
  }
  function initUI(){
    ui=document.createElement('div');ui.id='jujian-native-reader';
    ui.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483600';
    shadow=ui.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      :host{all:initial;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#243a30}
      *{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}
      #fab{pointer-events:auto;position:fixed;right:22px;bottom:24px;padding:10px 15px;border:1px solid #9dc5b1;border-radius:999px;background:#176d55;color:#fff;font-size:13px;box-shadow:0 3px 15px #0003}
      #panel{pointer-events:auto;position:fixed;right:22px;bottom:76px;width:min(320px,calc(100vw - 28px));padding:18px;border:1px solid #b7cfc0;border-radius:14px;background:#f8fbf8;color:#243a30;box-shadow:0 8px 30px #0004;font-size:13px;line-height:1.6}
      #panel{max-height:calc(100dvh - 96px);overflow:auto}
      #panel[hidden]{display:none}h2{margin:0;font-size:17px}p{margin:10px 0}#status{color:#486958}#close{float:right;border:0;background:transparent;font-size:21px;color:#567060;padding:0 3px}
      #enable{width:100%;border:0;border-radius:8px;padding:10px;background:#206d55;color:white;font-weight:600}
      label{display:flex;justify-content:space-between;margin-top:14px}input{width:100%;accent-color:#206d55}.hint{font-size:12px;color:#668071}
      label[hidden]{display:none}.jujian-appearance{margin-top:14px}.jujian-appearance summary{cursor:pointer;font-weight:600}
      input[type=color]{width:48px;height:28px}
      .project-links{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid #d6e3da;font-size:12px}
      .project-links a{color:#206d55;text-underline-offset:3px}
    </style><button id="fab" aria-expanded="false">句间 · 阅读</button>
    <section id="panel" hidden aria-label="句间阅读设置"><button id="close" aria-label="关闭阅读设置">×</button>
    <h2>句间 · 0.3.10</h2><p id="status" role="status"></p>
    <button id="enable">启用单页阅读</button>
    <label>每个长页约含 <select id="page-count">${jujianPageCount.options}</select></label>
    <label>使用滚动模式的行宽 <input id="fit-width" style="width:auto" type="checkbox" checked></label>
    <div id="fixed-width" hidden><label for="width">固定页宽 <span id="width-value">900px</span></label>
    <input id="width" aria-label="固定页宽" type="range" min="680" max="960" step="20" value="900"></div>
    ${jujianTypography.markup}
    ${jujianAppearance.textColorMarkup}
    ${jujianAppearance.markup}
    <p class="hint">点击正文虚线查看书友想法。</p>
    <footer class="project-links">
      <a href="https://github.com/lione12138/Jvjian/tree/main/src" target="_blank" rel="noopener noreferrer">查看源码</a>
      <a href="https://github.com/lione12138/Jvjian" target="_blank" rel="noopener noreferrer">支持一下 · GitHub Star</a>
    </footer></section>`;
    const panel=shadow.getElementById('panel'),fab=shadow.getElementById('fab');
    const close=()=>{panel.hidden=true;fab.setAttribute('aria-expanded','false');};
    fab.addEventListener('click',()=>{panel.hidden=!panel.hidden;fab.setAttribute('aria-expanded',String(!panel.hidden));});
    shadow.getElementById('close').addEventListener('click',close);
    shadow.getElementById('enable').addEventListener('click',()=>saveEnabled(!active));
    shadow.getElementById('page-count').addEventListener('change',event=>{
      pageCount=Number(event.target.value);
      applyLayout();
      chrome.storage.local.set({longPageCount:pageCount});
    });
    shadow.getElementById('fit-width').addEventListener('change',event=>{
      fitWidth=event.target.checked;
      applyLayout();
      chrome.storage.local.set({singlePageFitWidth:fitWidth});
    });
    shadow.getElementById('width').addEventListener('input',event=>{
      width=boundedWidth(event.target.value);updateUI();scheduleLayout();
    });
    shadow.getElementById('width').addEventListener('change',()=>chrome.storage.local.set({singlePageWidth:width}));
    for(const control of jujianTypography.controls){
      const {key}=control;
      shadow.getElementById(key).addEventListener('change',event=>{
        typography[key]=jujianTypography.valueFor(control,event.target.value);
        applyLayout();
        chrome.storage.local.set({[key]:typography[key]});
      });
    }
    refreshAppearance=jujianAppearance.connect(shadow,changes=>chrome.storage.local.set(changes));
    refreshAppearance(appearance);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    document.documentElement.append(ui);
  }
  async function init(){
    const style=document.createElement('style');style.id='jujian-native-layout-style';
    style.textContent=`
      /* body selects the native column count. The chapter's measured width
         independently determines line breaks and the native canvas width. */
      html.${ROOT_CLASS}{--jujian-sheet-width:min(var(--jujian-viewport-width),var(--jujian-page-width))}
      /* The scrolling reader uses 800/616/488px for text at its desktop
         breakpoints. Add the paginator's 70px text gutter on each side. */
      html.${FIT_CLASS}{--jujian-sheet-width:min(var(--jujian-viewport-width),940px)}
      @media(max-width:1365px){
        html.${FIT_CLASS}{--jujian-sheet-width:min(var(--jujian-viewport-width),756px)}
      }
      @media(max-width:1023px){
        html.${FIT_CLASS}{--jujian-sheet-width:min(var(--jujian-viewport-width),628px)}
      }
      @media(max-width:767px){
        html.${FIT_CLASS}{--jujian-sheet-width:var(--jujian-viewport-width)}
      }
      html.${ROOT_CLASS} body{width:min(1059px,var(--jujian-sheet-width))!important;max-width:100%!important;min-width:0!important;margin-inline:0!important}
      html.${ROOT_CLASS} .wr_horizontalReader{width:var(--jujian-viewport-width)!important;max-width:none!important}
      /* Native drag-selection uses renderTargetContainer.offsetLeft. Use the
         viewport-wide parent as its coordinate origin for a centered sheet. */
      html.${ROOT_CLASS} .readerChapterContent_container{position:relative}
      html.${ROOT_CLASS} .wr_horizontalReader .readerChapterContent{position:static;width:var(--jujian-sheet-width)!important;max-width:none!important;box-sizing:border-box;margin-inline:auto!important}
      html.${ROOT_CLASS} .wr_horizontalReader{--jujian-paper-base:#1c1c1d;--jujian-color-strength:32%;--jujian-outer-base:#262628;--jujian-outer-strength:18%;--jujian-wallpaper-top:72px;--jujian-wallpaper-height:calc(100vh - 132px)}
      html.${ROOT_CLASS} .wr_whiteTheme .wr_horizontalReader{--jujian-paper-base:#fff;--jujian-color-strength:63%;--jujian-outer-base:#f4f5f7;--jujian-outer-strength:35%}
      html.${LONG_CLASS} .wr_horizontalReader{--jujian-wallpaper-height:calc(100vh - var(--jujian-wallpaper-top))}
      @media(max-width:700px){
        html.${ROOT_CLASS} .wr_horizontalReader{--jujian-wallpaper-top:0px;--jujian-wallpaper-height:100vh}
      }
      html.${ROOT_CLASS} .wr_horizontalReader .readerControls{right:calc((var(--jujian-viewport-width) - var(--jujian-sheet-width))/2 + 8px)!important}
      @media(min-width:701px){
        /* On a normal-height sheet the reader subtracts a 66px vertical
           gutter itself. Preserve both the paper's top and that local origin. */
        html.${ROOT_CLASS}:not(.${LONG_CLASS}) .readerChapterContent_container{box-sizing:border-box;border-top:66px solid transparent}
        html.${ROOT_CLASS}:not(.${LONG_CLASS}) .wr_horizontalReader .readerChapterContent{height:calc(100vh - 132px);margin-top:6px}
      }
      /* Native font layout, canvas and the underline hit targets all read
         readerChapterContent.clientHeight. Set a real layout height; scaling
         the bitmap would only magnify the original page. */
      html.${LONG_CLASS}{overflow-y:auto!important;overflow-anchor:none}
      html.${LONG_CLASS} body,html.${LONG_CLASS} #app{height:auto!important;overflow:visible!important}
      /* Multiply the ordinary content height, then add one set of margins. */
      html.${LONG_CLASS} .wr_horizontalReader{--jujian-sheet-height:max(100vh,calc((100vh - 132px) * var(--jujian-page-count) + 132px));height:var(--jujian-sheet-height)!important;max-height:none!important}
      html.${LONG_CLASS} .wr_horizontalReader .readerChapterContent{height:calc(var(--jujian-sheet-height) - 132px)!important;max-height:none!important;flex:none!important}
      html.${ROOT_CLASS} .reader_float_review_with_range_panel_wrapper{position:fixed!important;inset:0!important;height:100%!important;width:var(--jujian-viewport-width)!important;align-items:center;justify-content:center}
      html.${LONG_CLASS} .reader_float_review_with_range_panel_wrapper .reviews_panel{max-width:calc(100% - 24px);max-height:calc(100dvh - 32px)!important;margin:auto!important}
    `;
    document.documentElement.append(style);
    typographyStyle=document.createElement('style');
    typographyStyle.id='jujian-typography-style';
    document.documentElement.append(typographyStyle);
    appearanceStyle=document.createElement('style');
    appearanceStyle.id='jujian-appearance-style';
    document.documentElement.append(appearanceStyle);
    try{
      const settings=await chrome.storage.local.get(defaults);
      enabled=settings.singlePageEnabled!==false;width=boundedWidth(settings.singlePageWidth);
      pageCount=jujianPageCount.fromSettings(settings);
      fitWidth=settings.singlePageFitWidth!==false;
      appearance=jujianAppearance.normalize(settings);
      for(const control of jujianTypography.controls){
        typography[control.key]=jujianTypography.valueFor(control,settings[control.key]);
      }
    }catch{}
    initUI();
    if(enabled)enterPagination();
    applyLayout();
    new MutationObserver(records=>{
      if(records.some(record=>!ui.contains(record.target)))scheduleLayout();
    }).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',scheduleLayout,{passive:true});
    window.addEventListener('keydown',handleReadingKey,true);
    window.addEventListener('click',afterPagerClick,true);
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local'||!Object.keys(changes).some(key=>Object.hasOwn(defaults,key)))return;
      if(changes.singlePageEnabled)enabled=changes.singlePageEnabled.newValue!==false;
      if(changes.singlePageWidth)width=boundedWidth(changes.singlePageWidth.newValue);
      if(changes.longPageCount)pageCount=jujianPageCount.fromSettings({longPageCount:changes.longPageCount.newValue});
      if(changes.singlePageFitWidth)fitWidth=changes.singlePageFitWidth.newValue!==false;
      const appearanceChanges=Object.keys(changes).filter(key=>Object.hasOwn(jujianAppearance.defaults,key));
      if(appearanceChanges.length){
        appearance=jujianAppearance.normalize({
          ...appearance,...Object.fromEntries(appearanceChanges.map(key=>[key,changes[key].newValue])),
        });
        refreshAppearance(appearance);
      }
      for(const control of jujianTypography.controls){
        if(changes[control.key]){
          typography[control.key]=jujianTypography.valueFor(control,changes[control.key].newValue);
        }
      }
      if(changes.singlePageEnabled&&enabled)enterPagination();
      applyLayout();
    });
  }
  init();
})();
