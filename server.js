// CarePoint local hospital management app. Node.js 24+, no third-party packages.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = path.join(__dirname, 'carepoint.sqlite');
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','doctor','staff')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS patients(id INTEGER PRIMARY KEY, patient_no TEXT NOT NULL UNIQUE, name TEXT NOT NULL, dob TEXT, gender TEXT, phone TEXT, email TEXT, address TEXT, blood_group TEXT, allergies TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY, patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL, patient_name TEXT NOT NULL, doctor TEXT NOT NULL, department TEXT NOT NULL, appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL, reason TEXT, status TEXT NOT NULL DEFAULT 'Confirmed', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, head TEXT NOT NULL DEFAULT '', capacity INTEGER NOT NULL DEFAULT 0, color TEXT NOT NULL DEFAULT '#68b4a4');
CREATE TABLE IF NOT EXISTS beds(id INTEGER PRIMARY KEY, bed_no TEXT NOT NULL UNIQUE, department TEXT NOT NULL, ward TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Available','Occupied','Cleaning','Reserved')), patient_name TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS inventory(id INTEGER PRIMARY KEY, item TEXT NOT NULL, category TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'units', reorder_level INTEGER NOT NULL DEFAULT 10, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY, invoice_no TEXT NOT NULL UNIQUE, patient_name TEXT NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', due_date TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS appt_date_idx ON appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS patient_name_idx ON patients(name);`);
const stmt = (sql) => db.prepare(sql);
const exists = (table) => stmt(`SELECT COUNT(*) n FROM ${table}`).get().n > 0;
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = crypto.scryptSync(password, salt, 64).toString('hex'); return {salt, key};
}
if (!exists('users')) {
  for (const u of [{name:'Alex Morgan',email:'admin@carepoint.local',password:process.env.DEMO_PASSWORD||'CarePoint!2026',role:'admin'}, {name:'Dr. Emily Carter',email:'doctor@carepoint.local',password:'Doctor!2026',role:'doctor'}, {name:'Jamie Staff',email:'staff@carepoint.local',password:'Staff!2026',role:'staff'}]) {
    const p=hashPassword(u.password); stmt('INSERT INTO users(name,email,password_hash,salt,role) VALUES(?,?,?,?,?)').run(u.name,u.email,p.key,p.salt,u.role);
  }
}
if (!exists('departments')) for (const [name,head,capacity,color] of [['Cardiology','Dr. Emily Carter',48,'#68b4a4'],['Neurology','Dr. James Wilson',36,'#8aa2df'],['Orthopedics','Dr. Michael Chen',32,'#efb46e'],['Pediatrics','Dr. Sarah Kim',28,'#d98a96'],['General Medicine','Dr. Priya Shah',50,'#77a9bd']]) stmt('INSERT INTO departments(name,head,capacity,color) VALUES(?,?,?,?)').run(name,head,capacity,color);
if (!exists('patients')) {
  const patientData=[['Sophia Anderson','PT-2048','1988-05-14','Female','+1 555-0101','O+'],['Liam Thompson','PT-2031','1975-11-02','Male','+1 555-0102','A+'],['Isabella Garcia','PT-2055','2014-03-20','Female','+1 555-0103','B+'],['Noah Williams','PT-1987','1962-07-09','Male','+1 555-0104','AB+'],['Mia Robinson','PT-2060','1993-01-28','Female','+1 555-0105','O-'],['Ethan Patel','PT-1942','2001-09-11','Male','+1 555-0106','A-'],['Ava Martinez','PT-2016','1981-06-22','Female','+1 555-0107','B-'],['Lucas Brown','PT-2022','1957-12-05','Male','+1 555-0108','O+']];
  for (const p of patientData) stmt('INSERT INTO patients(name,patient_no,dob,gender,phone,blood_group) VALUES(?,?,?,?,?,?)').run(p[0],p[1],p[2],p[3],p[4],p[5]);
}
if (!exists('appointments')) {
  const data=[['Sophia Anderson','Dr. Emily Carter','Cardiology','09:00','Confirmed'],['Liam Thompson','Dr. James Wilson','Neurology','09:30','Checked in'],['Isabella Garcia','Dr. Sarah Kim','Pediatrics','10:00','Confirmed'],['Noah Williams','Dr. Michael Chen','Orthopedics','10:30','Waiting'],['Mia Robinson','Dr. Emily Carter','Cardiology','11:00','Confirmed'],['Ethan Patel','Dr. Sarah Kim','Pediatrics','11:30','Checked in'],['Ava Martinez','Dr. James Wilson','Neurology','12:00','Waiting'],['Lucas Brown','Dr. Michael Chen','Orthopedics','12:30','Confirmed']];
  const day = new Date().toISOString().slice(0,10); for(const a of data){const p=stmt('SELECT id FROM patients WHERE name=?').get(a[0]);stmt('INSERT INTO appointments(patient_id,patient_name,doctor,department,appointment_date,appointment_time,status) VALUES(?,?,?,?,?,?,?)').run(p.id,a[0],a[1],a[2],day,a[3],a[4]);}
}
if (!exists('beds')) for(let i=1;i<=40;i++){const status=i<=28?'Occupied':'Available';stmt('INSERT INTO beds(bed_no,department,ward,status,patient_name) VALUES(?,?,?,?,?)').run(`B-${String(i).padStart(3,'0')}`,['Cardiology','Neurology','Orthopedics','Pediatrics'][i%4],`Ward ${1+Math.floor((i-1)/10)}`,status,status==='Occupied'?`Patient ${i}`:'');}
if (!exists('inventory')) for(const x of [['Surgical gloves','PPE',420,'boxes',80],['Nitrile gloves','PPE',235,'boxes',60],['Syringes 5ml','Medical supplies',180,'units',50],['Face masks','PPE',920,'boxes',200],['Saline 500ml','Medication',84,'bags',30],['Bandage rolls','Medical supplies',145,'rolls',40]])stmt('INSERT INTO inventory(item,category,quantity,unit,reorder_level) VALUES(?,?,?,?,?)').run(...x);
if (!exists('invoices')) for(const [n,p,c,s,d] of [['INV-0892','Sophia Anderson',42000,'Paid','2026-10-20'],['INV-0893','Liam Thompson',126500,'Pending','2026-10-25'],['INV-0894','Noah Williams',78500,'Pending','2026-10-27'],['INV-0895','Mia Robinson',24600,'Overdue','2026-10-04']])stmt('INSERT INTO invoices(invoice_no,patient_name,amount_cents,status,due_date) VALUES(?,?,?,?,?)').run(n,p,c,s,d);

const sessions = new Map();
const roleRank={staff:1,doctor:2,admin:3};
function json(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(obj));}
function cookieMap(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(p=>p.length===2));}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(Error('Invalid JSON'))}});req.on('error',reject)});}
function audit(user,action,entity,id){stmt('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES(?,?,?,?)').run(user.id,action,entity,id||null)}
function safeUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role};}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);const route=url.pathname;
  if(route.startsWith('/api/')){
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'null'});return res.end();}
    try{
      if(route==='/api/login'&&req.method==='POST'){
        const b=await body(req);const u=stmt('SELECT * FROM users WHERE lower(email)=lower(?) AND active=1').get(String(b.email||''));
        const attempt=u?crypto.scryptSync(String(b.password||''),u.salt,64):Buffer.alloc(64);const match=u&&crypto.timingSafeEqual(attempt,Buffer.from(u.password_hash,'hex'));
        if(!match)return json(res,401,{error:'Email or password is incorrect.'});
        const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{id:u.id,created:Date.now()});audit(u,'sign_in','session');return json(res,200,{user:safeUser(u)},{'Set-Cookie':`cp_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
      }
      const cookies=cookieMap(req);const token=cookies.cp_session;let session=token&&sessions.get(token);let user=session&&stmt('SELECT id,name,email,role,active FROM users WHERE id=?').get(session.id);
      if(session&&Date.now()-session.created>8*60*60*1000){sessions.delete(token);session=null;user=null;}
      if(route==='/api/session'&&req.method==='GET')return user?json(res,200,{user:safeUser(user)}):json(res,200,{user:null});
      if(route==='/api/logout'&&req.method==='POST'){if(token){sessions.delete(token);if(user)audit(user,'sign_out','session');}return json(res,200,{ok:true},{'Set-Cookie':'cp_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
      if(!user||!user.active)return json(res,401,{error:'Sign in to continue.'});
      const need=(role)=>{if(roleRank[user.role]<roleRank[role])throw Object.assign(Error('You do not have permission for this action.'),{status:403});};
      if(route==='/api/dashboard'&&req.method==='GET'){
        const today=new Date().toISOString().slice(0,10);const month=today.slice(0,7);
        return json(res,200,{patientCount:stmt('SELECT COUNT(*) n FROM patients').get().n,appointmentCount:stmt('SELECT COUNT(*) n FROM appointments WHERE appointment_date=?').get(today).n,availableBeds:stmt("SELECT COUNT(*) n FROM beds WHERE status='Available'").get().n,totalBeds:stmt('SELECT COUNT(*) n FROM beds').get().n,occupiedBeds:stmt("SELECT COUNT(*) n FROM beds WHERE status='Occupied'").get().n,revenueCents:stmt("SELECT COALESCE(SUM(amount_cents),0) n FROM invoices WHERE status='Paid' AND strftime('%Y-%m',created_at)=?").get(month).n,departments:stmt('SELECT d.name, COUNT(DISTINCT p.id) patients, d.capacity, d.head FROM departments d LEFT JOIN patients p ON p.id IN (SELECT patient_id FROM appointments WHERE department=d.name) GROUP BY d.id').all(),lowStock:stmt('SELECT COUNT(*) n FROM inventory WHERE quantity <= reorder_level').get().n});
      }
      if(route==='/api/appointments'&&req.method==='GET'){const day=url.searchParams.get('date');const q=url.searchParams.get('q')||'';return json(res,200,{items:stmt(`SELECT * FROM appointments WHERE (?='' OR appointment_date=?) AND (patient_name LIKE ? OR doctor LIKE ? OR department LIKE ? OR status LIKE ?) ORDER BY appointment_date DESC, appointment_time`).all(day||'',day||'',`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)});}
      if(route==='/api/appointments'&&req.method==='POST'){const b=await body(req);if(!b.patient_name||!b.doctor||!b.department||!b.appointment_date||!b.appointment_time)return json(res,400,{error:'Patient, doctor, department, date and time are required.'});const p=stmt('SELECT id FROM patients WHERE name=?').get(b.patient_name);const r=stmt('INSERT INTO appointments(patient_id,patient_name,doctor,department,appointment_date,appointment_time,reason,status) VALUES(?,?,?,?,?,?,?,?)').run(p?.id||null,String(b.patient_name),String(b.doctor),String(b.department),String(b.appointment_date),String(b.appointment_time),String(b.reason||''),'Confirmed');audit(user,'create','appointment',Number(r.lastInsertRowid));return json(res,201,{item:stmt('SELECT * FROM appointments WHERE id=?').get(Number(r.lastInsertRowid))});}
      const appt=route.match(/^\/api\/appointments\/(\d+)$/);if(appt&&req.method==='PATCH'){const b=await body(req);const old=stmt('SELECT * FROM appointments WHERE id=?').get(Number(appt[1]));if(!old)return json(res,404,{error:'Appointment not found.'});const status=b.status||old.status;if(!['Confirmed','Checked in','Waiting','Completed','Cancelled'].includes(status))return json(res,400,{error:'Invalid appointment status.'});stmt('UPDATE appointments SET status=? WHERE id=?').run(status,old.id);audit(user,'update','appointment',old.id);return json(res,200,{item:stmt('SELECT * FROM appointments WHERE id=?').get(old.id)});}
      if(route==='/api/patients'&&req.method==='GET'){const q=url.searchParams.get('q')||'';return json(res,200,{items:stmt('SELECT * FROM patients WHERE name LIKE ? OR patient_no LIKE ? OR phone LIKE ? ORDER BY created_at DESC').all(`%${q}%`,`%${q}%`,`%${q}%`)});}
      if(route==='/api/patients'&&req.method==='POST'){const b=await body(req);if(!b.name)return json(res,400,{error:'Patient name is required.'});const no='PT-'+crypto.randomInt(2100,9999);const r=stmt('INSERT INTO patients(patient_no,name,dob,gender,phone,email,address,blood_group,allergies,notes) VALUES(?,?,?,?,?,?,?,?,?,?)').run(no,String(b.name),b.dob||null,b.gender||null,b.phone||null,b.email||null,b.address||null,b.blood_group||null,b.allergies||null,b.notes||null);audit(user,'create','patient',Number(r.lastInsertRowid));return json(res,201,{item:stmt('SELECT * FROM patients WHERE id=?').get(Number(r.lastInsertRowid))});}
      const pat=route.match(/^\/api\/patients\/(\d+)$/);if(pat&&req.method==='GET'){const p=stmt('SELECT * FROM patients WHERE id=?').get(Number(pat[1]));return p?json(res,200,{item:p}):json(res,404,{error:'Patient not found.'});}if(pat&&req.method==='PATCH'){const b=await body(req);const old=stmt('SELECT * FROM patients WHERE id=?').get(Number(pat[1]));if(!old)return json(res,404,{error:'Patient not found.'});const fields=['name','dob','gender','phone','email','address','blood_group','allergies','notes'];const vals=fields.map(k=>b[k]===undefined?old[k]:b[k]);stmt(`UPDATE patients SET ${fields.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...vals,old.id);audit(user,'update','patient',old.id);return json(res,200,{item:stmt('SELECT * FROM patients WHERE id=?').get(old.id)});}if(pat&&req.method==='DELETE'){need('admin');stmt('DELETE FROM patients WHERE id=?').run(Number(pat[1]));audit(user,'delete','patient',Number(pat[1]));return json(res,200,{ok:true});}
      if(route==='/api/departments'&&req.method==='GET')return json(res,200,{items:stmt('SELECT * FROM departments ORDER BY name').all()});
      if(route==='/api/beds'&&req.method==='GET')return json(res,200,{items:stmt('SELECT * FROM beds ORDER BY bed_no').all()});
      const bed=route.match(/^\/api\/beds\/(\d+)$/);if(bed&&req.method==='PATCH'){need('staff');const b=await body(req);if(!['Available','Occupied','Cleaning','Reserved'].includes(b.status))return json(res,400,{error:'Invalid bed status.'});stmt("UPDATE beds SET status=?,patient_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.status,String(b.patient_name||''),Number(bed[1]));audit(user,'update','bed',Number(bed[1]));return json(res,200,{item:stmt('SELECT * FROM beds WHERE id=?').get(Number(bed[1]))});}
      if(route==='/api/inventory'&&req.method==='GET')return json(res,200,{items:stmt('SELECT * FROM inventory ORDER BY item').all()});
      if(route==='/api/inventory'&&req.method==='POST'){need('staff');const b=await body(req);if(!b.item)return json(res,400,{error:'Item name is required.'});const r=stmt('INSERT INTO inventory(item,category,quantity,unit,reorder_level) VALUES(?,?,?,?,?)').run(String(b.item),String(b.category||'General'),Number(b.quantity)||0,String(b.unit||'units'),Number(b.reorder_level)||10);audit(user,'create','inventory',Number(r.lastInsertRowid));return json(res,201,{item:stmt('SELECT * FROM inventory WHERE id=?').get(Number(r.lastInsertRowid))});}
      if(route==='/api/invoices'&&req.method==='GET')return json(res,200,{items:stmt('SELECT * FROM invoices ORDER BY created_at DESC').all()});
      const inv=route.match(/^\/api\/invoices\/(\d+)$/);if(inv&&req.method==='PATCH'){need('staff');const b=await body(req);if(!['Pending','Paid','Overdue','Cancelled'].includes(b.status))return json(res,400,{error:'Invalid invoice status.'});stmt('UPDATE invoices SET status=? WHERE id=?').run(b.status,Number(inv[1]));audit(user,'update','invoice',Number(inv[1]));return json(res,200,{item:stmt('SELECT * FROM invoices WHERE id=?').get(Number(inv[1]))});}
      if(route==='/api/users'&&req.method==='GET'){need('admin');return json(res,200,{items:stmt('SELECT id,name,email,role,active,created_at FROM users ORDER BY name').all()});}
      if(route==='/api/users'&&req.method==='POST'){need('admin');const b=await body(req);if(!b.name||!b.email||String(b.password||'').length<12||!['admin','doctor','staff'].includes(b.role))return json(res,400,{error:'Provide name, email, a password of at least 12 characters, and a valid role.'});const p=hashPassword(String(b.password));const r=stmt('INSERT INTO users(name,email,password_hash,salt,role) VALUES(?,?,?,?,?)').run(String(b.name),String(b.email).toLowerCase(),p.key,p.salt,b.role);audit(user,'create','user',Number(r.lastInsertRowid));return json(res,201,{item:safeUser(stmt('SELECT * FROM users WHERE id=?').get(Number(r.lastInsertRowid)))});}
      if(route==='/api/audit'&&req.method==='GET'){need('admin');return json(res,200,{items:stmt('SELECT a.id,a.action,a.entity,a.entity_id,a.created_at,u.name AS user FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100').all()});}
      return json(res,404,{error:'API route not found.'});
    }catch(e){console.error(e);return json(res,e.status||500,{error:e.status?e.message:'The request could not be completed.'});}
  }
  if(route==='/favicon.ico'){res.writeHead(204);return res.end();}
  const file=route==='/'?path.join(__dirname,'index.html'):path.join(__dirname,path.basename(route));
  if(!file.startsWith(__dirname)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
});
server.listen(PORT,HOST,()=>console.log(`CarePoint running at http://${HOST}:${PORT}\nDatabase: ${DB_PATH}\nDemo admin: admin@carepoint.local / CarePoint!2026`));
process.on('SIGINT',()=>{server.close(()=>{db.close();process.exit(0)});});
