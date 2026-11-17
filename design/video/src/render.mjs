import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const FPS=20, DUR=41;
fs.rmSync('frames',{recursive:true,force:true}); fs.mkdirSync('frames');
const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,defaultViewport:{width:720,height:1280,deviceScaleFactor:1}});
const p=await b.newPage();
await p.goto(pathToFileURL('video.html').href);
await p.evaluate(()=>document.fonts.ready);
await p.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
const only=process.argv[2]; // seconds list for stills
if(only){for(const t of only.split(',')){await p.evaluate(t=>document.getAnimations().forEach(a=>a.currentTime=t*1000),+t);await p.screenshot({path:`still-${t}.png`});}}
else{
for(let i=0;i<FPS*DUR;i++){await p.evaluate(t=>document.getAnimations().forEach(a=>a.currentTime=t),i*1000/FPS);
 await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:90});}
}
await b.close();
