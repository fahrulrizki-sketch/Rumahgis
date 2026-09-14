import fs from 'node:fs/promises';
import { instagramClient, instagramPlan, contentKey } from './instagram.mjs';
import { publishSocial } from './social-run.mjs';
if(process.env.GITHUB_RUN_ATTEMPT!=='1') throw Error('Pengulangan diblokir.');
const post=JSON.parse(await fs.readFile('content/drafts/megathrust-jawa-20260910.json','utf8'));
const token=process.env.THREADS_ACCESS_TOKEN.trim();
const root='18431698300181482';
const state={key:contentKey(post),threads:{status:'STARTED',items:[]},instagram:{status:'PENDING'}};
async function save(){await fs.writeFile('megathrust-final-state.json',JSON.stringify(state,null,2));}
async function api(path,params={},method='GET') {
 const url=new URL(`https://graph.threads.net/v1.0/${path}`);
 const init={method,headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)};
 if(method==='POST') init.body=new URLSearchParams(params); else for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const r=await fetch(url,init);const b=await r.json();
 if(!r.ok){const e=Error(`Threads HTTP ${r.status}, code ${Number(b.error?.code)}, subcode ${Number(b.error?.error_subcode)}`);e.code=b.error?.code;e.subcode=b.error?.error_subcode;throw e;}return b;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const me=await api('me',{fields:'id,username'});if(me.username!=='rumahgis')throw Error('Akun salah');
 const original=await api(root,{fields:'id,text,permalink'});if(original.text!==post.main.text)throw Error('Root berbeda');
 const conversation=await api(`${root}/conversation`,{fields:'id,text,permalink',limit:'100'});
 if(conversation.paging?.next)throw Error('Percakapan membutuhkan pemeriksaan lebih lanjut');
 const existing=conversation.data||[];
 // Rekonsiliasi hanya prefix yang tepat; tidak mengulang bagian yang telah terbit.
 let parent=root;
 for(let i=0;i<existing.length;i++) {
   const matches=existing.filter(x=>x.text===post.replies[i]?.text);
   if(matches.length!==1)throw Error('Isi percakapan bukan prefix unik dari utas');
   parent=matches[0].id;state.threads.items.push({id:parent,index:i+1,status:'PUBLISHED'});
 }
 const ig=instagramClient({token:process.env.INSTAGRAM_ACCESS_TOKEN,userId:process.env.INSTAGRAM_USER_ID});
 await ig.verify();await save();
 for(let i=existing.length;i<post.replies.length;i++) {
   const item=post.replies[i];
   const params={media_type:'TEXT',text:item.text,reply_to_id:parent};
   if(item.media?.image_url){params.media_type='IMAGE';params.image_url=item.media.image_url;}
   const c=await api(`${me.id}/threads`,params,'POST');if(!c.id)throw Error('Container kosong');
   const entry={index:i+1,container:c.id,status:'CREATED'};state.threads.items.push(entry);await save();
   await wait(5000);
   let result;
   for(let attempt=0;attempt<12;attempt++) {
     entry.status='STARTED';await save();
     try {result=await api(`${me.id}/threads_publish`,{creation_id:c.id},'POST');break;}
     catch(e){
       // Respons media belum siap memastikan belum terbit; hanya container yang sama diulang.
       if(e.code===24&&e.subcode===4279009){entry.status='NOT_READY';await save();await wait(5000);continue;}
       throw e;
     }
   }
   if(!result?.id)throw Error('Container belum siap setelah batas tunggu');
   parent=result.id;entry.id=parent;entry.status='PUBLISHED';await save();
 }
 state.threads.status='PUBLISHED';state.threads.result={root_id:root};state.threads.permalink=original.permalink;await save();
 await publishSocial({state,save,client:ig,plan:instagramPlan(post),threads:()=>{throw Error('Threads tidak boleh dimulai ulang');}});
 console.log(JSON.stringify(state));
} catch(e) {
 await save();console.error('Publikasi berhenti:',e.message.replaceAll(token,'[REDACTED]'));
 console.log(JSON.stringify(state));process.exitCode=1;
}
