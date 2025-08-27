/* Simple polling-based live reload for development.
   Automatically reloads the page when monitored files change.
   Only runs on localhost / 127.0.0.1 */
(function(){
  if(!/localhost|127\.0\.0\.1/.test(location.host)) return;
  const sources = [
    'core/dist/index.umd.js',
    'editor/dist/index.umd.js',
    'app.js',
    'assets/editor.css'
  ];
  const hashes = Object.create(null);
  const interval = 1500; // ms

  async function computeHash(url){
    try {
      const res = await fetch(url + '?lr=' + Date.now(), { cache: 'no-store' });
      if(!res.ok) return null;
      const text = await res.text();
      // lightweight string hash
      let h = 0;
      for(let i=0;i<text.length;i++) h = (h * 31 + text.charCodeAt(i)) | 0;
      return h;
    } catch(err){
      return null;
    }
  }

  async function tick(){
    for(const url of sources){
      const h = await computeHash(url);
      if(h == null) continue;
      if(hashes[url] === undefined){
        hashes[url] = h;
      } else if(hashes[url] !== h){
        console.log('[live-reload] Change detected in', url, '– reloading page');
        location.reload();
        return; // stop further checks after reload trigger
      }
    }
    setTimeout(tick, interval);
  }

  console.log('[live-reload] Watching for changes...');
  tick();
})();
