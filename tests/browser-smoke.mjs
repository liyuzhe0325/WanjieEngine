import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const port=8765, base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function serverReady(){for(let i=0;i<50;i++){try{const r=await fetch(base);if(r.ok)return;}catch{}await delay(200);}throw Error('HTTP server did not start');}
try {
 await serverReady();
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-web-security']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 page.on('requestfailed',r=>errors.push('request failed: '+r.url()+' '+r.failure()?.errorText));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('notice')?.textContent.includes('准备就绪'),{timeout:30000});
 const canvas=page.locator('#viewport canvas');await canvas.waitFor({timeout:10000});
 if(await canvas.count()!==1)throw Error('Canvas not initialized');
 await page.waitForFunction(()=>document.body.dataset.previewAsset==='pieces/obelisk',{timeout:25000});
 if(!((await page.locator('#notice').textContent())||'').includes('glTF'))throw Error('GLTF preview status missing');
 await page.locator('[data-angle="55"]').click();
 if(await page.locator('#angle').textContent()!=='55°')throw Error('Angle toggle failed');
 await page.locator('[data-angle="70"]').click();
 await page.locator('[data-tool="forest"]').click();
 const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width*.52,box.y+box.height*.51);
 await page.waitForTimeout(500);
 if(!((await page.locator('#notice').textContent())||'').includes('已应用'))throw Error('Terrain edit did not apply');
 await page.locator('#undo').click();
 if(!((await page.locator('#notice').textContent())||'').includes('撤销成功'))throw Error('Undo did not complete');
 await page.locator('#redo').click();
 if(!((await page.locator('#notice').textContent())||'').includes('重做成功'))throw Error('Redo did not complete');
 if(errors.length)throw Error(errors.join('\n'));
 await mkdir('test-artifacts',{recursive:true});
 for(const angle of [55,70,85]){
   await page.locator('[data-angle="'+angle+'"]').click();
   await page.waitForTimeout(160);
   await page.screenshot({path:'test-artifacts/board-'+angle+'.png',fullPage:true});
 }
 await page.locator('[data-angle="55"]').click();
 await page.locator('[data-quality="standard"]').click();
 await page.waitForTimeout(2500);
 const standard=await page.evaluate(()=>window.wanjieRenderStats());
 await page.screenshot({path:'test-artifacts/quality-standard.png',fullPage:true});
 await page.locator('[data-quality="high"]').click();
 // SwiftShader is a software GPU: one GTAO frame can take several seconds.
 // Observe a bounded wall-clock interval instead of requiring a minimum FPS.
 await page.waitForTimeout(5000);
 const high=await page.evaluate(()=>window.wanjieRenderStats());
 await page.screenshot({path:'test-artifacts/quality-high.png',fullPage:true,timeout:45000});
 const perf={environment:'GitHub Actions Chromium SwiftShader software GPU; not representative of discrete GPU performance',standard,high,observedAt:new Date().toISOString()};
 await (await import('node:fs/promises')).writeFile('test-artifacts/performance.json',JSON.stringify(perf,null,2));
 console.log('Renderer measurements:',JSON.stringify(perf));
 if(high.preset!=='high'||standard.preset!=='standard')throw Error('Render quality toggle failed');
 if(standard.renderedFrames<1||high.renderedFrames<1)throw Error('Rendering stalled: zero completed frames in preset; inspect performance.json');
 if(errors.length)throw Error(errors.join('\\n'));
 await page.screenshot({path:'test-artifacts/board.png',fullPage:true});
 console.log('Browser startup, WebGL canvas, camera switching, editor click: PASS');
} catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.kill();}
