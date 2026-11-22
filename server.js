const http = require('http');
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, 'public');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain','.xml':'application/xml'};
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
function json(res, code, obj){ res.writeHead(code, {'Content-Type':'application/json', ...CORS}); res.end(JSON.stringify(obj)); }
const OEMBED={'youtube.com':'https://www.youtube.com/oembed','youtu.be':'https://www.youtube.com/oembed','vimeo.com':'https://vimeo.com/api/oembed.json','tiktok.com':'https://www.tiktok.com/oembed','x.com':'https://publish.twitter.com/oembed','twitter.com':'https://publish.twitter.com/oembed','dailymotion.com':'https://www.dailymotion.com/services/oembed','reddit.com':'https://www.reddit.com/oembed','tumblr.com':'https://www.tumblr.com/oembed/1.0','rumble.com':'https://rumble.com/api/Media/oembed.json'};
const INSTANCES = ["https://api.cobalt.liubquanti.click/"];
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (u.pathname === '/api/health') return json(res, 200, {ok:true, service:'SocialGrabber', time:new Date().toISOString()});
  if (u.pathname === '/api/oembed') {
    const raw = u.searchParams.get('url')||''; let t; try{ t=new URL(raw); }catch{ return json(res,400,{error:'Invalid URL'}); }
    const host=t.hostname.replace(/^www\.|^m\./,''); const ep=Object.entries(OEMBED).find(([k])=>host===k||host.endsWith('.'+k));
    if(!ep) return json(res,200,{meta:null});
    try{ const r=await fetch(ep[1]+'?url='+encodeURIComponent(t.href)+'&format=json'); if(!r.ok) return json(res,200,{meta:null}); return json(res,200,{meta: await r.json()}); }catch{ return json(res,200,{meta:null}); }
  }
  if (u.pathname === '/api/cobalt' && req.method==='POST') {
    let raw=''; req.on('data',c=>raw+=c); req.on('end', async ()=>{
      let body; try{ body=JSON.parse(raw); }catch{ return json(res,400,{status:'error',error:{code:'bad_request'}}); }
      const url=String(body.url||'');
      if(!/^https?:\/\//i.test(url) || /(localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.)/.test(url)) return json(res,400,{status:'error',error:{code:'error.link.invalid'}});
      const payload={ url, videoQuality:String(body.videoQuality||'720'), downloadMode: body.downloadMode==='audio'?'audio':'auto' };
      if(payload.downloadMode==='audio') payload.audioFormat='mp3';
      let lastErr='unreachable';
      for(const base of INSTANCES){
        try{
          const r=await fetch(base,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify(payload)});
          const data=await r.json().catch(()=>null);
          if(data && data.status && data.status!=='error') return json(res,200,data);
          if(data){ lastErr=(data.error&&data.error.code)||'error'; if(!String(lastErr).includes('auth')) return json(res,200,data); }
        }catch(e){ lastErr='network.unreachable'; }
      }
      if (/youtube\.com|youtu\.be/.test(url)) return json(res,200,{status:'redirect', url:'https://'+(req.headers.host||'socialgrabber-f5b44.containers.snapdeploy.app')+'/api/ytdl?url='+encodeURIComponent(url)+'&q='+encodeURIComponent(payload.videoQuality)+(payload.downloadMode==='audio'?'&audio=1':''), filename:'socialgrabber-download.'+(payload.downloadMode==='audio'?'mp3':'mp4')});
      return json(res,502,{status:'error',error:{code:lastErr}});
    });
    return;
  }

  if (u.pathname === '/api/ytdl') {
    const raw = u.searchParams.get('url')||''; const q = u.searchParams.get('q')||'720'; const audio = u.searchParams.get('audio')==='1';
    if(!/^https?:\/\//i.test(raw) || /(localhost|127\.0\.0\.1)/.test(raw)) { res.writeHead(400); return res.end('bad url'); }
    const { spawn } = require('child_process');
    const fmt = audio ? 'bestaudio[ext=m4a]/bestaudio' : (q<='360' ? '18/best[height<='+q+']/best' : 'best[height<='+q+'][ext=mp4]/best[height<='+q+']/best');
    const args = ['--no-playlist','--no-warnings','--js-runtimes','node','-f',fmt,'-o','-'];
    args.push(raw);
    const p = spawn('yt-dlp', args, {stdio:['ignore','pipe','pipe']});
    let err=''; p.stderr.on('data',d=>err+=d);
    res.writeHead(200, {'Content-Type': audio?'audio/mp4':'video/mp4', 'Content-Disposition':'attachment; filename="socialgrabber-download.'+(audio?'mp3':'mp4')+'"'});
    p.stdout.pipe(res);
    p.on('error', ()=>{ try{res.end();}catch{} });
    req.on('close', ()=>{ try{p.kill('SIGKILL');}catch{} });
    return;
  }
  let p = decodeURIComponent(u.pathname); if (p==='/') p='/index.html';
  const fp = path.join(PUB, p);
  if (!fp.startsWith(PUB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('Not found'); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(fp)]||'application/octet-stream'});
  fs.createReadStream(fp).pipe(res);
});
server.listen(process.env.PORT || 7860, '0.0.0.0', ()=>console.log('SocialGrabber up'));
