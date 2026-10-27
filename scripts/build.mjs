import {build,transform} from 'esbuild';
import {marked} from 'marked';
import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {watch} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pages} from '../src/pages.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dist=path.join(root,'dist');
const read=file=>readFile(path.join(root,file),'utf8');
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=x=>x.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
marked.use({renderer:{heading({tokens,depth}){const text=this.parser.parseInline(tokens);return `<h${depth} id="${slug(text.replace(/<[^>]*>/g,''))}">${text}</h${depth}>\n`;}}});
export async function generate(){
 const config=JSON.parse(await read('site.config.json')),catalog=JSON.parse(await read('public/data/catalog.json'));
 const origin=new URL(config.siteUrl);if(origin.protocol!=='https:'||!origin.pathname.endsWith('/'))throw Error('siteUrl must be an HTTPS base ending with /');
 await mkdir(dist,{recursive:true});await cp(path.join(root,'public'),dist,{recursive:true});
 await build({entryPoints:['site','models','atlas'].map(name=>path.join(root,`src/${name}.js`)),outdir:path.join(dist,'assets'),bundle:true,minify:true,splitting:true,format:'esm',target:['es2022'],legalComments:'linked'});
 await writeFile(path.join(dist,'assets/style.css'),(await transform(await read('src/style.css'),{loader:'css',minify:true})).code);
 const markdown=await read('content/investigation.md'),headings=marked.lexer(markdown).filter(t=>t.type==='heading'&&t.depth===2);
 const toc=`<ol>${headings.map(h=>`<li><a href="#${slug(h.text)}">${esc(h.text)}</a></li>`).join('')}</ol>`;
 for(const [key,title,body] of pages(marked.parse(markdown),toc,catalog)){
  const base=key==='home'?'./':'../',url=new URL(key==='home'?'':key+'/',origin).href,image=new URL('images/social-preview.jpg',origin).href;
  const metadata=[['og:title',`${title} · ${config.title}`],['og:description',config.description],['og:type',key==='story'?'article':'website'],['og:site_name',config.title],['og:url',url],['og:image',image],['og:image:type','image/jpeg'],['og:image:width','1200'],['og:image:height','630'],['og:image:alt','Corncob Contemplated: a member of the game’s remarkably rude polygonal ground crew.']].map(([k,v])=>`<meta property="${k}" content="${esc(v)}">`).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(config.description)}"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#13201b">${metadata}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title+' · '+config.title)}"><meta name="twitter:description" content="${esc(config.description)}"><meta name="twitter:image" content="${image}"><link rel="canonical" href="${url}"><title>${esc(title)} · ${config.title}</title><link rel="icon" href="${base}images/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/style.css"></head><body data-page="${key}" class="${['models','atlas'].includes(key)?'dark-page':''}"><a class="skip" href="#main">Skip to content</a><header class="topbar"><div class="brand-links"><a class="brand parent-brand" href="https://lostengines.com/">Lost Engines</a><a class="brand" href="${base}">CORNCOB<span>Contemplated</span></a></div><button class="menu-toggle" data-menu aria-expanded="false" aria-controls="navigation">Menu</button><nav class="nav-links" id="navigation" aria-label="Main navigation">${[['story','The investigation'],['atlas','World atlas'],['models','Model gallery'],['music','Listening room']].map(([id,label])=>`<a href="${base}${id}/"${id===key?' aria-current="page"':''}>${label}</a>`).join('')}</nav></header><main id="main">${body}</main><footer class="footer"><p><strong>Corncob Contemplated</strong> · A Lost Engines investigation.<br>Corncob 3D by Kevin Stokes and George Welch / Pie in the Sky Software.<br>Original game, models, artwork and music remain the work of their creators.</p><div><a href="${esc(config.analysisUrl)}">Corncob project &amp; full research archive ↗</a><br><a href="${esc(config.repositoryUrl)}">Site source on GitHub ↗</a><br><a href="https://lost-engines.github.io/darker-discovered/">Also: Darker Discovered ↗</a></div></footer><script type="module" src="${base}assets/site.js"></script>${['models','atlas'].includes(key)?`<script type="module" src="${base}assets/${key}.js"></script>`:''}</body></html>`;
  const dir=key==='home'?dist:path.join(dist,key);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),html);
 }
 await writeFile(path.join(dist,'.nojekyll'),'');await writeFile(path.join(dist,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · Corncob Contemplated</title><h1>Page not found</h1><p><a href="${esc(config.siteUrl)}">Return to Corncob Contemplated</a>.</p></html>`);
 console.log(`Built Corncob Contemplated: ${catalog.worlds.length} worlds, ${catalog.banks.length} model collections → dist/`);
}
await rm(dist,{recursive:true,force:true});await generate();
if(process.argv.includes('--serve')){const{serve}=await import('./serve.mjs');await serve();let timer,busy=false,pending=false;const update=async()=>{if(busy){pending=true;return;}busy=true;try{await generate();}catch(e){console.error(e);}finally{busy=false;if(pending){pending=false;update();}}};for(const dir of ['src','content','public'])watch(path.join(root,dir),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(update,150);});}
