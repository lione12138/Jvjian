'use strict';
const $=id=>document.getElementById(id);
$('page-count').innerHTML=jujianPageCount.options;
async function init(){
  const values=await chrome.storage.local.get({singlePageEnabled:true,singlePageWidth:900,singlePageFitWidth:true,...jujianPageCount.defaults});
  $('enabled').checked=values.singlePageEnabled!==false;
  $('page-count').value=String(jujianPageCount.fromSettings(values));
  $('fit-width').checked=values.singlePageFitWidth!==false;
  $('fixed-width').hidden=$('fit-width').checked;
  $('width').value=String(Math.max(680,Math.min(960,Number(values.singlePageWidth)||900)));
  $('width-value').textContent=`${$('width').value}px`;
}
$('enabled').addEventListener('change',async()=>{
  await chrome.storage.local.set({singlePageEnabled:$('enabled').checked});
  $('status').textContent='已应用到打开的阅读页。';
});
$('page-count').addEventListener('change',async()=>{
  await chrome.storage.local.set({longPageCount:Number($('page-count').value)});
  $('status').textContent='页长设置已保存。';
});
$('width').addEventListener('input',()=>{$('width-value').textContent=`${$('width').value}px`;});
$('fit-width').addEventListener('change',async()=>{
  $('fixed-width').hidden=$('fit-width').checked;
  await chrome.storage.local.set({singlePageFitWidth:$('fit-width').checked});
  $('status').textContent='正文宽度已更新。';
});
$('width').addEventListener('change',async()=>{
  await chrome.storage.local.set({singlePageWidth:Number($('width').value)});
  $('status').textContent='页面宽度已保存。';
});
init().catch(()=>{$('status').textContent='设置读取失败，请重新打开弹窗。';});
