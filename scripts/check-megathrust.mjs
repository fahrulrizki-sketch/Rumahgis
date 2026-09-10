import fs from 'node:fs/promises';
const token = process.env.THREADS_ACCESS_TOKEN?.trim();
async function get(path) {
 const r=await fetch(`https://graph.threads.net/v1.0/${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
 const b=await r.json(); if(!r.ok) throw Error(`HTTP ${r.status} code ${b.error?.code}`); return b;
}
const me=await get('me?fields=id,username'); if(me.username!=='rumahgis') throw Error('Akun salah');
const list=await get(`${me.id}/threads?fields=id,text,permalink,timestamp&limit=100`);
const posts=list.data.filter(x=>x.text?.includes('Megathrust di selatan Jawa')||x.text?.includes('1/7 Megathrust'));
const result={posts};
for(const p of posts) { try {p.replies=await get(`${p.id}/conversation?fields=id,text,permalink,timestamp&limit=100`);}catch(e){p.error=e.message;} }
await fs.writeFile('megathrust-reconciliation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
