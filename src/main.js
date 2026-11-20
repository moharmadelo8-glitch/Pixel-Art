import { readPsd, writePsd } from 'ag-psd';
import './style.css';

const $ = (id) => document.getElementById(id);
const state = { width: 0, height: 0, layers: [], active: 0, tool: 'move', zoom: 1, drawing: false, last: null, history: [], future: [], frames: [], playing: false };
const display = $('displayCanvas');
const ctx = display.getContext('2d', { willReadFrequently: true });
const toast = (message) => { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2600); };
const active = () => state.layers[state.active];
const makeLayer = (name = 'Layer') => ({ name, canvas: Object.assign(document.createElement('canvas'), { width: state.width, height: state.height }), visible: true, opacity: 1, blend: 'source-over', locked: false });
function snapshot() { if (!state.width) return; state.history.push(JSON.stringify(serialize())); if (state.history.length > 30) state.history.shift(); state.future = []; }
function serialize() { return { width: state.width, height: state.height, active: state.active, layers: state.layers.map(l => ({ name:l.name, visible:l.visible, opacity:l.opacity, blend:l.blend, locked:l.locked, data:l.canvas.toDataURL('image/png') })) }; }
function restore(data) {
  state.width = data.width; state.height = data.height; state.layers = [];
  return Promise.all(data.layers.map(item => new Promise(resolve => { const layer = makeLayer(item.name); Object.assign(layer, { visible:item.visible, opacity:item.opacity, blend:item.blend, locked:item.locked }); const img = new Image(); img.onload = () => { layer.canvas.getContext('2d').drawImage(img,0,0); state.layers.push(layer); resolve(); }; img.onerror = resolve; img.src = item.data; }))).then(() => { state.active = Math.min(data.active || 0, state.layers.length - 1); render(); });
}
function render() {
  if (!state.width) return;
  display.width = state.width; display.height = state.height;
  ctx.clearRect(0,0,state.width,state.height);
  for (const layer of state.layers) if (layer.visible) { ctx.save(); ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blend; ctx.drawImage(layer.canvas,0,0); ctx.restore(); }
  $('canvasWrap').hidden = false; $('welcome').hidden = true;
  display.style.width = `${state.width * state.zoom}px`; display.style.height = `${state.height * state.zoom}px`;
  $('statusDimensions').textContent = `${state.width} × ${state.height}`;
  $('zoomLabel').textContent = `${Math.round(state.zoom*100)}%`;
  renderLayers();
}
function renderLayers() {
  const list = $('layerList'); list.replaceChildren();
  state.layers.forEach((layer,i) => {
    const row = document.createElement('div'); row.className = 'layer-row' + (i===state.active?' selected':'');
    const eye = document.createElement('button'); eye.textContent = layer.visible ? '◉' : '○'; eye.title = 'Toggle visibility';
    eye.onclick = e => { e.stopPropagation(); layer.visible = !layer.visible; render(); };
    const thumb = document.createElement('canvas'); thumb.width=36; thumb.height=28; thumb.className='layer-thumb'; thumb.getContext('2d').drawImage(layer.canvas,0,0,36,28);
    const name = document.createElement('span'); name.textContent = layer.name; name.className='layer-name';
    const lock = document.createElement('span'); lock.textContent = layer.locked ? '🔒' : '';
    row.append(eye,thumb,name,lock); row.onclick = () => { state.active=i; syncLayerControls(); renderLayers(); }; list.prepend(row);
  });
  if (!state.layers.length) list.textContent='No layers yet';
}
function syncLayerControls() { const l=active(); if(!l)return; $('layerOpacity').value=Math.round(l.opacity*100); $('layerOpacityValue').textContent=Math.round(l.opacity*100)+'%'; $('layerVisible').checked=l.visible; $('blendMode').value=l.blend; }
function createDocument(w,h) { if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>10000||h>10000) return toast('Enter a valid size (1–10000 px).'); state.width=w; state.height=h; state.layers=[]; state.active=0; const l=makeLayer('Background'); l.canvas.getContext('2d').fillStyle='#ffffff'; l.canvas.getContext('2d').fillRect(0,0,w,h); state.layers.push(l); snapshot(); render(); syncLayerControls(); $('documentTitle').textContent='Untitled'; toast('Document created'); }
function addLayer(name) { if(!state.width)return toast('Create or open a document first.'); snapshot(); state.layers.push(makeLayer(name || `Layer ${state.layers.length+1}`)); state.active=state.layers.length-1; render(); syncLayerControls(); }
function importImage(file) { if(!file)return; const url=URL.createObjectURL(file), img=new Image(); img.onload=()=>{ if(!state.width) {state.width=img.naturalWidth;state.height=img.naturalHeight;state.layers=[];} snapshot(); const l=makeLayer(file.name.replace(/\.[^.]+$/,'')); l.canvas.getContext('2d').drawImage(img,0,0,state.width,state.height); state.layers.push(l); state.active=state.layers.length-1; render(); syncLayerControls(); $('documentTitle').textContent=file.name; URL.revokeObjectURL(url); toast('Image imported'); }; img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not open this image.');}; img.src=url; }
function download(blob,name) { const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportImage(type='image/png') { if(!state.width)return toast('Nothing to export.'); display.toBlob(b=>b&&download(b,type==='image/jpeg'?'pixel-art.jpg':'pixel-art.png'),type,type==='image/jpeg'?0.92:undefined); }
function point(e) { const r=display.getBoundingClientRect(); return {x:(e.clientX-r.left)*state.width/r.width,y:(e.clientY-r.top)*state.height/r.height}; }
function paint(e) { const l=active(); if(!l||l.locked)return; const p=point(e), c=l.canvas.getContext('2d'); c.save(); c.globalAlpha=Number($('brushOpacity').value)/100; c.lineWidth=Math.max(1,Number($('brushSize').value)||1); c.lineCap='round'; c.lineJoin='round'; c.strokeStyle=$('foregroundColor').value; c.globalCompositeOperation=state.tool==='eraser'?'destination-out':'source-over'; c.beginPath(); if(state.last){c.moveTo(state.last.x,state.last.y);c.lineTo(p.x,p.y);}else{c.moveTo(p.x,p.y);c.lineTo(p.x+0.01,p.y+0.01);} c.stroke(); c.restore(); state.last=p; render(); }
display.addEventListener('pointerdown',e=>{if(!state.width)return; if(state.tool==='eyedropper'){const p=point(e),d=ctx.getImageData(Math.max(0,Math.floor(p.x)),Math.max(0,Math.floor(p.y)),1,1).data; const hex='#'+[...d.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join(''); $('foregroundColor').value=hex;$('swatchColor').value=hex;return;} snapshot(); state.drawing=true;state.last=null;display.setPointerCapture(e.pointerId); if(state.tool==='brush'||state.tool==='eraser')paint(e); else state.last=point(e); });
display.addEventListener('pointermove',e=>{if(!state.drawing)return; if(state.tool==='brush'||state.tool==='eraser')paint(e); else if(state.tool==='move'){const p=point(e),l=active();if(l&&!l.locked&&state.last){const dx=p.x-state.last.x,dy=p.y-state.last.y;const temp=document.createElement('canvas');temp.width=state.width;temp.height=state.height;temp.getContext('2d').drawImage(l.canvas,dx,dy);l.canvas.getContext('2d').clearRect(0,0,state.width,state.height);l.canvas.getContext('2d').drawImage(temp,0,0);state.last=p;render();}}});
function endDraw(){state.drawing=false;state.last=null;} display.addEventListener('pointerup',endDraw);display.addEventListener('pointercancel',endDraw);
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{state.tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));$('toolName').textContent=({move:'Move Tool',brush:'Brush Tool',eraser:'Eraser Tool',eyedropper:'Eyedropper'})[state.tool];$('toolHint').textContent=state.tool==='move'?'Drag to move the active layer':'Click or drag on the canvas';}));
$('foregroundColor').addEventListener('input',e=>$('swatchColor').value=e.target.value);$('swatchColor').addEventListener('input',e=>$('foregroundColor').value=e.target.value);
$('brushOpacity').addEventListener('input',e=>$('opacityValue').textContent=e.target.value+'%');
$('fileInput').addEventListener('change',e=>{importImage(e.target.files[0]);e.target.value='';});
['welcomeImport','importButton'].forEach(id=>$(id).onclick=()=>$('fileInput').click());
$('newDocument').onclick=$('createBlank').onclick=()=>$('modal').hidden=false;$('cancelNew').onclick=()=>$('modal').hidden=true;
$('confirmNew').onclick=()=>{createDocument(Number($('newWidth').value),Number($('newHeight').value));$('modal').hidden=true;};
$('addLayer').onclick=()=>addLayer();$('deleteLayer').onclick=()=>{if(state.layers.length<2)return toast('Keep at least one layer.');snapshot();state.layers.splice(state.active,1);state.active=Math.max(0,state.active-1);render();syncLayerControls();};
$('duplicateLayer').onclick=()=>{const l=active();if(!l)return; snapshot();const n=makeLayer(l.name+' copy');n.canvas.getContext('2d').drawImage(l.canvas,0,0);Object.assign(n,{visible:l.visible,opacity:l.opacity,blend:l.blend});state.layers.splice(state.active+1,0,n);state.active++;render();syncLayerControls();};
$('renameLayer').onclick=()=>{const l=active();if(!l)return;const n=prompt('Layer name',l.name);if(n){l.name=n;renderLayers();}};
$('lockLayer').onclick=()=>{const l=active();if(l){l.locked=!l.locked;$('lockLayer').textContent=l.locked?'Unlock':'Lock';renderLayers();}};
$('layerOpacity').oninput=e=>{if(active()){active().opacity=Number(e.target.value)/100;$('layerOpacityValue').textContent=e.target.value+'%';render();}};
$('layerVisible').onchange=e=>{if(active()){active().visible=e.target.checked;render();}};
$('blendMode').onchange=e=>{if(active()){active().blend=e.target.value;render();}};
$('undo').onclick=()=>{if(!state.history.length)return;state.future.push(JSON.stringify(serialize()));const prev=JSON.parse(state.history.pop());restore(prev);};
$('redo').onclick=()=>{if(!state.future.length)return;state.history.push(JSON.stringify(serialize()));const next=JSON.parse(state.future.pop());restore(next);};
$('saveProject').onclick=()=>{if(!state.width)return toast('Nothing to save.');download(new Blob([JSON.stringify(serialize())],{type:'application/json'}),'pixel-art.pixelart');};
$('openProject').onclick=()=>$('projectInput').click();$('projectInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await restore(JSON.parse(await f.text()));syncLayerControls();$('documentTitle').textContent=f.name;}catch{toast('Invalid project file.');}e.target.value='';};
$('exportPng').onclick=()=>exportImage('image/png');$('exportJpg').onclick=()=>exportImage('image/jpeg');
$('filePsd').onclick=()=>$('psdInput').click();$('psdInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const psd=readPsd(await f.arrayBuffer());createDocument(psd.width,psd.height);const l=active();if(psd.canvas)l.canvas.getContext('2d').drawImage(psd.canvas,0,0);else if(psd.children?.length)toast('PSD layers found; flattened preview is unavailable for this file.');render();toast('PSD imported');}catch(err){toast('PSD import failed: '+err.message);}e.target.value='';};
$('exportPsd').onclick=async()=>{if(!state.width)return toast('Nothing to export.');try{const psd={width:state.width,height:state.height,children:state.layers.map(l=>({name:l.name,canvas:l.canvas,opacity:l.opacity,hidden:!l.visible}))};download(new Blob([writePsd(psd)],{type:'image/vnd.adobe.photoshop'}),'pixel-art.psd');}catch(err){toast('PSD export failed: '+err.message);}};
$('zoomIn').onclick=()=>{state.zoom=Math.min(4,state.zoom*1.2);render();};$('zoomOut').onclick=()=>{state.zoom=Math.max(.1,state.zoom/1.2);render();};$('zoomFit').onclick=$('fitCanvas').onclick=()=>{if(!state.width)return;const a=$('canvasArea');state.zoom=Math.min((a.clientWidth-80)/state.width,(a.clientHeight-80)/state.height,1);render();};
$('addFrame').onclick=()=>{if(!state.width)return toast('Create a document first.');state.frames.push(serialize());const n=document.createElement('button');n.textContent='Frame '+state.frames.length;n.onclick=()=>restore(state.frames[Number(n.textContent.split(' ')[1])-1]);$('timelineFrames').append(n);};
$('playTimeline').onclick=()=>toast(state.frames.length?'Frame preview is ready; animation playback is not implemented yet.':'Add frames to the timeline first.');
$('exportFrames').onclick=()=>toast('Frame export is not available yet.');
$('cropSelection').onclick=()=>toast('Selection and crop tool are not implemented yet.');
$('applyAdjustments').onclick=()=>{const l=active();if(!l)return; snapshot();const c=l.canvas.getContext('2d'),im=c.getImageData(0,0,state.width,state.height),d=im.data,b=Number($('brightness').value),k=(259*(Number($('contrast').value)+255))/(255*(259-Number($('contrast').value))),sat=Number($('saturation').value)/100+1,gray=$('grayscale').checked,inv=$('invert').checked;for(let i=0;i<d.length;i+=4){let [r,g,bl]=[d[i],d[i+1],d[i+2]];r=k*(r-128)+128+b;g=k*(g-128)+128+b;bl=k*(bl-128)+128+b;const avg=.2126*r+.7152*g+.0722*bl;if(gray){r=g=bl=avg;}else{r=avg+(r-avg)*sat;g=avg+(g-avg)*sat;bl=avg+(bl-avg)*sat;}if(inv){r=255-r;g=255-g;bl=255-bl;}d[i]=Math.max(0,Math.min(255,r));d[i+1]=Math.max(0,Math.min(255,g));d[i+2]=Math.max(0,Math.min(255,bl));}c.putImageData(im,0,0);const blur=Number($('blur').value);if(blur){const temp=document.createElement('canvas');temp.width=state.width;temp.height=state.height;temp.getContext('2d').filter='blur('+blur+'px)';temp.getContext('2d').drawImage(l.canvas,0,0);c.clearRect(0,0,state.width,state.height);c.drawImage(temp,0,0);}render();toast('Adjustments applied');};
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{const menu=b.dataset.menu;if(menu==='file')$('openProject').click();else if(menu==='edit')toast('Use Undo and Redo tools.');else if(menu==='image')$('adjustmentPanel').hidden=!$('adjustmentPanel').hidden;else if(menu==='layer')$('addLayer').click();else if(menu==='view')$('zoomFit').click();});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y')$('redo').click();else if(e.key.toLowerCase()==='b')document.querySelector('[data-tool="brush"]').click();else if(e.key.toLowerCase()==='v')document.querySelector('[data-tool="move"]').click();else if(e.key.toLowerCase()==='e')document.querySelector('[data-tool="eraser"]').click();else if(e.key.toLowerCase()==='i')document.querySelector('[data-tool="eyedropper"]').click();else if(e.key==='Escape')$('modal').hidden=true;});
