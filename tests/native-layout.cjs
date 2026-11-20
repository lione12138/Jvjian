const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function page(settings={},initialRoot=true){
  const classes=new Set(),properties=new Map(),timers=new Map(),observers=[],windowListeners=new Map(),elements=new Map();
  let storageListener,root=initialRoot?{}:null,resizeCount=0,toggleCount=0,nextTimer=0;
  class Element{
    constructor(){this.listeners=new Map();this.style={cssText:''};this.hidden=false;this.value='';this.textContent='';}
    addEventListener(name,fn){this.listeners.set(name,fn);}
    setAttribute(){} append(){} contains(target){return target===this;}
    attachShadow(){return {set innerHTML(value){},getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);}};}
  }
  const body=new Element();
  Object.defineProperty(body,'clientWidth',{get(){return classes.has('jujian-single-page')?1059:1400;}});
  const chapter={get clientWidth(){
    return classes.has('jujian-fit-width')?1400:Math.min(1400,parseFloat(properties.get('--jujian-page-width'))||900);
  }};
  const document={body,documentElement:{clientWidth:1400,clientHeight:760,classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}},style:{setProperty(name,value){properties.set(name,value);}},append(){}},
    createElement(){return new Element();},addEventListener(){},querySelector(selector){
      if(selector==='.wr_horizontalReader')return root;
      if(selector==='.wr_horizontalReader .readerChapterContent')return root&&chapter;
      if(selector==='.readerControls_item.isNormalReader')return {click(){toggleCount++;}};
      return null;
    }};
  const window={innerWidth:1400,innerHeight:760,addEventListener(name,fn){windowListeners.set(name,fn);},dispatchEvent(event){resizeCount++;windowListeners.get(event.type)?.(event);}};
  const context={document,window,Event:class{constructor(type){this.type=type;}},
    setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
    MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},
    chrome:{storage:{local:{async get(defaults){return {...defaults,...settings};},async set(values){Object.assign(settings,values);}},onChanged:{addListener(fn){storageListener=fn;}}}}};
  vm.createContext(context);
  for(const script of ['src/page-count.js','src/native-layout.js']){
    vm.runInContext(fs.readFileSync(script,'utf8'),context);
  }
  await new Promise(setImmediate);
  return {
    classes,settings,elements,get resizeCount(){return resizeCount;},get toggleCount(){return toggleCount;},
    change(values){const changes={};for(const [key,newValue]of Object.entries(values)){changes[key]={newValue};settings[key]=newValue;}storageListener(changes,'local');},
    insertRoot(){root={};for(const observer of observers)observer([{target:body}]);},
    mutateReader(){for(const observer of observers)observer([{target:body}]);},
    flush(){let iterations=0;while(timers.size){assert.ok(++iterations<10,'layout timers must settle');const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback();}}
  };
}

test('late native reader insertion activates layout and settles after native rerender',async()=>{
  const p=await page({},false);
  assert.equal(p.classes.has('jujian-single-page'),false);
  p.insertRoot();p.flush();
  assert.equal(p.classes.has('jujian-single-page'),true);
  const count=p.resizeCount;
  p.mutateReader();p.flush();
  assert.equal(p.resizeCount,count,'native DOM rerender must not restart resize endlessly');
});

test('storage toggle restores native layout and can enable it again without reloading',async()=>{
  const p=await page();assert.equal(p.classes.has('jujian-single-page'),true);
  p.change({singlePageEnabled:false});p.flush();
  assert.equal(p.classes.has('jujian-single-page'),false);
  assert.equal(p.elements.get('status').textContent,'已恢复微信读书原生布局。');
  const count=p.resizeCount;
  p.change({singlePageEnabled:true});p.flush();
  assert.equal(p.classes.has('jujian-single-page'),true);assert.equal(p.resizeCount,count+1);
});

test('changing the manual width while enabled repaginates once and settles',async()=>{
  const p=await page({singlePageFitWidth:false}),count=p.resizeCount;
  p.change({singlePageWidth:820});p.flush();
  assert.equal(p.resizeCount,count+1);
  p.mutateReader();p.flush();assert.equal(p.resizeCount,count+1);
});

test('a saved disabled setting leaves native pagination untouched',async()=>{
  const p=await page({singlePageEnabled:false},false);p.flush();
  assert.equal(p.classes.has('jujian-single-page'),false);assert.equal(p.toggleCount,0);
});

test('six pages is the default and changing the long-page count repaginates once',async()=>{
  const p=await page();
  assert.equal(p.elements.get('page-count').value,'6');
  const count=p.resizeCount;
  p.change({longPageCount:8});p.flush();
  assert.equal(p.elements.get('page-count').value,'8');
  assert.equal(p.resizeCount,count+1);
  p.mutateReader();p.flush();
  assert.equal(p.resizeCount,count+1);
});

test('the old one-page setting applies until a page count is chosen',async()=>{
  const p=await page({longPageEnabled:false});
  assert.equal(p.elements.get('page-count').value,'1');
  assert.equal(p.classes.has('jujian-long-page'),false);
  p.change({longPageCount:3});p.flush();
  assert.equal(p.elements.get('page-count').value,'3');
  assert.equal(p.classes.has('jujian-long-page'),true);
  const reopened=await page(p.settings);
  assert.equal(reopened.elements.get('page-count').value,'3');
});
