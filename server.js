const express=require('express');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const Database=require('better-sqlite3');

const app=express();
app.use(express.json({limit:'2mb'}));
const PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,'data');
fs.mkdirSync(DATA,{recursive:true});
const db=new Database(path.join(DATA,'notes.db'));
db.pragma('journal_mode=WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notes(
 id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL DEFAULT '',
 content TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT '#fff3a6',
 pin INTEGER NOT NULL DEFAULT 0,
 deleted INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sessions(
 token TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
`);

function hash(p){return crypto.createHash('sha256').update(process.env.PASSWORD_SALT||'simple-local-salt').update(p).digest('hex')}
function auth(req,res,next){
 const h=req.headers.authorization||'';
 const token=h.startsWith('Bearer ')?h.slice(7):'';
 const row=db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires_at>?').get(token,Date.now());
 if(!row)return res.status(401).json({error:'登录已过期'});
 req.userId=row.user_id;next();
}
app.post('/api/register',(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(),p=String(req.body.password||'');
 if(!email||p.length<6)return res.status(400).json({error:'邮箱或密码不正确'});
 try{
   const info=db.prepare('INSERT INTO users(email,password,created_at) VALUES(?,?,?)').run(email,hash(p),Date.now());
   return issue(info.lastInsertRowid,res);
 }catch(e){return res.status(400).json({error:'这个邮箱已经注册'})}
});
app.post('/api/login',(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(),p=String(req.body.password||'');
 const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 if(!u||u.password!==hash(p))return res.status(401).json({error:'邮箱或密码错误'});
 issue(u.id,res);
});
function issue(uid,res){
 const t=crypto.randomBytes(32).toString('hex');
 db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(t,uid,Date.now()+1000*60*60*24*30);
 res.json({token:t});
}
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/notes',auth,(req,res)=>{
 const rows=db.prepare('SELECT id,title,content,color,pin,deleted,created_at AS createdAt,updated_at AS updatedAt FROM notes WHERE user_id=? AND deleted=0 ORDER BY pin DESC,updated_at DESC').all(req.userId);
 res.json({notes:rows});
});
app.post('/api/notes',auth,(req,res)=>{
 const id=crypto.randomUUID(),now=Date.now();
 const title=String(req.body.title||''),content=String(req.body.content||''),color=String(req.body.color||'#fff3a6'),pin=req.body.pin?1:0;
 db.prepare('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?)').run(id,req.userId,title,content,color,pin,0,now,now);
 res.json({note:{id,title,content,color,pin,deleted:0,createdAt:now,updatedAt:now}});
});
app.put('/api/notes/:id',auth,(req,res)=>{
 const old=db.prepare('SELECT * FROM notes WHERE id=? AND user_id=?').get(req.params.id,req.userId);
 if(!old)return res.status(404).json({error:'便签不存在'});
 const now=Date.now(),title=String(req.body.title??old.title),content=String(req.body.content??old.content),color=String(req.body.color??old.color),pin=req.body.pin?1:0;
 db.prepare('UPDATE notes SET title=?,content=?,color=?,pin=?,updated_at=? WHERE id=? AND user_id=?').run(title,content,color,pin,now,req.params.id,req.userId);
 res.json({note:{id:old.id,title,content,color,pin,deleted:0,createdAt:old.created_at,updatedAt:now}});
});
app.delete('/api/notes/:id',auth,(req,res)=>{
 db.prepare('UPDATE notes SET deleted=1,updated_at=? WHERE id=? AND user_id=?').run(Date.now(),req.params.id,req.userId);
 res.json({ok:true});
});
app.use(express.static(path.join(__dirname,'public')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log('云便签已启动: http://localhost:'+PORT));
