/* =========================================================
   BKM SMART SCHOOL — SHARED CORE (loaded by every page)
   Firebase init + CDN fallback, session/login state, toast,
   theme, clock, shared topbar/sidebar chrome rendering.
   Page-specific logic (attendance, saraban, supervision, ...)
   lives in each page's own <script> and calls into this file.
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyC3wIfLmTusbz1RD0g6JAJEXmwiiV4ZcC8",
  authDomain: "bkm-smart-school.firebaseapp.com",
  databaseURL: "https://bkm-smart-school-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bkm-smart-school",
  storageBucket: "bkm-smart-school.firebasestorage.app",
  messagingSenderId: "279250652300",
  appId: "1:279250652300:web:07e55d4ac7cabbce0e3fa9",
  measurementId: "G-MLQ7L38DR0"
};

const FIREBASE_SDK_URL = "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js";
const FB_VERSION = "12.15.0";
/* ลำดับ CDN สำรอง — ถ้า gstatic ถูกบล็อก (ไฟร์วอลล์โรงเรียน/ad blocker)
   ระบบจะลอง jsdelivr และ unpkg ต่อให้อัตโนมัติ */
const FB_CDNS = [
  "https://www.gstatic.com/firebasejs/" + FB_VERSION + "/",
  "https://cdn.jsdelivr.net/npm/firebase@" + FB_VERSION + "/",
  "https://unpkg.com/firebase@" + FB_VERSION + "/"
];

let db = null;
let FIREBASE_READY = false;

function loadScriptOnce(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('โหลดไม่สำเร็จ: ' + src)); };
    document.head.appendChild(s);
  });
}

function sdkPresent(){
  return typeof firebase !== 'undefined' && typeof firebase.database === 'function';
}

/* พยายามโหลด SDK จาก CDN แรกที่ใช้ได้ (ตัวแรกโหลดมาแล้วจาก <script src> ด้านล่างหน้า) */
async function ensureFirebaseSdk(){
  if (sdkPresent()) return true;
  for (var i = 1; i < FB_CDNS.length; i++){
    try {
      if (typeof firebase === 'undefined'){
        await loadScriptOnce(FB_CDNS[i] + 'firebase-app-compat.js');
      }
      if (!sdkPresent()){
        await loadScriptOnce(FB_CDNS[i] + 'firebase-database-compat.js');
      }
      if (sdkPresent()){
        console.info('Firebase SDK โหลดสำเร็จจาก CDN สำรอง:', FB_CDNS[i]);
        return true;
      }
    } catch (err){
      console.warn('CDN ใช้ไม่ได้:', FB_CDNS[i], err.message);
    }
  }
  return false;
}

function showFirebaseLoadError(){
  const root = document.querySelector('.viewport') || document.body;
  root.innerHTML = `
    <div style="min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px; text-align:center; font-family:'Noto Sans Thai',sans-serif;">
      <div style="max-width:340px;">
        <div style="width:64px;height:64px;border-radius:50%;background:#FBE8E8;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <span class="material-symbols-outlined" style="font-size:32px;color:#C53434;">wifi_off</span>
        </div>
        <h2 style="font-size:18px;margin:0 0 8px;color:#101828;">เชื่อมต่อ Firebase ไม่สำเร็จ</h2>
        <p style="font-size:14px;color:#4B5566;line-height:1.6;margin:0 0 16px;">
          ไม่สามารถโหลดไลบรารี Firebase จาก gstatic.com ได้ สาเหตุที่เป็นไปได้:
        </p>
        <ul style="text-align:left;font-size:13px;color:#4B5566;line-height:1.7;margin:0 0 16px;padding-left:20px;">
          <li>อินเทอร์เน็ตหลุดหรือช้าเกินไปขณะโหลดหน้า</li>
          <li>เครือข่าย/ไฟร์วอลล์ของโรงเรียนบล็อกการเข้าถึง gstatic.com</li>
          <li>โปรแกรมบล็อกโฆษณา (ad blocker) บล็อกสคริปต์นี้</li>
        </ul>
        <button onclick="location.reload()" style="width:100%;height:46px;border:none;border-radius:999px;background:#154FCE;color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-bottom:12px;">ลองใหม่อีกครั้ง</button>
        <a href="${FIREBASE_SDK_URL}" target="_blank" style="display:inline-block;font-size:13px;color:#154FCE;">ทดสอบเปิดลิงก์นี้ในแท็บใหม่ &raquo;</a>
        <p style="font-size:12px;color:#8995A8;margin-top:16px;">ระบบได้ลองโหลดจาก CDN สำรอง (jsdelivr, unpkg) แล้วแต่ไม่สำเร็จทั้งหมด — แสดงว่าเครือข่ายนี้บล็อกอยู่ ลองเปลี่ยนเครือข่าย (เช่น ใช้ 4G มือถือ) หรือปิด ad blocker แล้วกด "ลองใหม่อีกครั้ง"</p>
      </div>
    </div>`;
}

/* ---------------- MODULE REGISTRY ---------------- */
/* ---------------- CROSS-PAGE NAVIGATION ----------------
   Targets containing ".html" go through location.href (real page
   navigation). Bare targets (e.g. "home", "attendance") go through
   location.hash — used only within index.html's own local router. */
function navigateApp(target){
  if (target.indexOf('.html') !== -1){ location.href = target; }
  else { location.hash = target; }
}

/* ---------------- SHARED BOTTOM NAV / SIDEBAR CONFIG ----------------
   Routes always point at index.html + hash, since the bottom nav is
   rendered on every page (index.html and every standalone module page)
   and must work identically no matter which page it's clicked from. */
const BottomNavItems = [
  { id:'home',       icon:'home',       label:'หน้าหลัก',   route:'index.html#home' },
  { id:'attendance', icon:'fact_check', label:'เช็คชื่อ',    route:'index.html#attendance' },
  { id:'dashboard',  icon:'dashboard',  label:'แดชบอร์ด',   route:'index.html#dashboard', adminOnly:true },
  { id:'profile',    icon:'person',     label:'โปรไฟล์',    route:'index.html#profile' },
  { id:'settings',   icon:'settings',  label:'ตั้งค่า',      route:'index.html#settings' }
];

/* ---------------- SESSION STATE ---------------- */
let currentUserId = null;  // push key of users/{key}, or null
let userProfile = null;    // users/{currentUserId} record
let appSettings = {};      // settings/ record
let sessionResolved = false;
let domTimerDone = false;
let geoCoords = null;       // last known {lat,lng} from this device

function isAdmin(){ return !!(userProfile && userProfile.role === 'admin'); }

function avatarUrl(){
  const seed = (userProfile && userProfile.name) || 'U';
  return 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(seed) + '&backgroundType=solid&backgroundColor=154fce';
}

function dateKey(d){
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------------- GENERIC HTML ESCAPE (used by every module) ---------------- */
function sbEsc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------------- TOP APP BAR + SIDEBAR (shared across every page) ---------------- */
function renderTopbar(t){
  const el = document.getElementById('app-topbar');
  if (!t){ el.innerHTML = ''; return; }
  let left;
  if (t.left === 'brand'){
    left = `<div class="topbar-left">
      <div class="topbar-avatar"><img src="${avatarUrl()}" alt="avatar"></div>
      <span class="topbar-title">BKM Smart School</span>
    </div>`;
  } else {
    left = `<div class="topbar-left">
      <button class="icon-btn" aria-label="กลับ" onclick="navigateApp('${t.back}')"><span class="material-symbols-outlined">arrow_back</span></button>
      <span class="topbar-title">${t.title || ''}</span>
    </div>`;
  }
  let right = '<span style="width:38px;" aria-hidden="true"></span>';
  if (t.right === 'icon'){
    right = `<button class="icon-btn" aria-label="${t.rightIcon}" onclick="navigateApp('${t.rightRoute}')"><span class="material-symbols-outlined">${t.rightIcon}</span></button>`;
  } else if (t.right === 'badge'){
    right = `<span class="badge badge-neutral">${t.rightText}</span>`;
  } else if (t.left === 'brand'){
    right = `<button class="icon-btn" aria-label="การแจ้งเตือน"><span class="material-symbols-outlined">notifications</span></button>`;
  }
  el.innerHTML = left + right;
}

function renderBottomNav(activeId){
  const mount = document.getElementById('bottom-nav-mount');
  const admin = isAdmin();
  const items = BottomNavItems.filter(i => !i.adminOnly || admin);
  mount.innerHTML = items.map(i => `
    <a class="nav-item ${i.id === activeId ? 'active' : ''}" href="${i.route}">
      <span class="material-symbols-outlined ${i.id === activeId ? 'icon-fill' : ''}">${i.icon}</span>
      <span class="nav-label">${i.label}</span>
    </a>`).join('');
}

function showAppChrome(){
  const topbar = document.getElementById('app-topbar');
  const bottomnav = document.getElementById('bottom-nav-mount');
  const sidebarBrand = document.querySelector('.sidebar-brand');
  if (topbar) topbar.style.display = 'flex';
  if (bottomnav) bottomnav.style.display = 'flex';
  if (sidebarBrand) sidebarBrand.style.display = ''; // let CSS (mobile:none / desktop:flex) decide
}

function hideAppChrome(){
  const topbar = document.getElementById('app-topbar');
  const bottomnav = document.getElementById('bottom-nav-mount');
  const sidebarBrand = document.querySelector('.sidebar-brand');
  if (topbar) topbar.style.display = 'none';
  if (bottomnav) bottomnav.style.display = 'none';
  if (sidebarBrand) sidebarBrand.style.display = 'none';
}

/* ---------------- TOAST / CLOCK / THEME ---------------- */
function ensureToastHost(){
  let host = document.querySelector('.toast-host');
  if (!host){ host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
  return host;
}
function showToast(message, type){
  const host = ensureToastHost();
  const icons = { success:'check_circle', error:'error', info:'info' };
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = `<span class="material-symbols-outlined">${icons[type] || 'notifications'}</span><span>${message}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3500);
}

/* ---------------- CLOCKS ---------------- */
function startClock(timeElId, dateElId){
  function tick(){
    const now = new Date();
    const t = document.getElementById(timeElId);
    const d = document.getElementById(dateElId);
    if (t) t.textContent = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    if (d) d.textContent = now.toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' });
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------------- THEME (UI preference only — fine to keep local) ---------------- */
function initTheme(){
  const saved = localStorage.getItem('bkm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelectorAll('[data-theme-toggle]').forEach(t => { t.checked = saved === 'dark'; });
}
function toggleTheme(checked){
  const next = checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bkm_theme', next);
}

/* ---------------- SESSION + SPLASH ---------------- */
/* ---------------- SESSION (restore on load / log out) ----------------
   Pure: does NOT trigger any navigation itself. Each page's own boot
   sequence decides what to do once this resolves (show splash then
   route, or redirect to login if no session found). */
async function resumeSession(){
  const savedId = localStorage.getItem('bkm_uid');
  if (savedId && FIREBASE_READY){
    try {
      const snap = await db.ref('users/' + savedId).once('value');
      if (snap.exists()){
        currentUserId = savedId;
        userProfile = snap.val();
      } else {
        localStorage.removeItem('bkm_uid');
      }
    } catch (err){
      showToast('เชื่อมต่อฐานข้อมูลไม่สำเร็จ: ' + err.message, 'error');
    }
  }
  sessionResolved = true;
}

function logout(){
  localStorage.removeItem('bkm_uid');
  currentUserId = null;
  userProfile = null;
  showToast('ออกจากระบบในอุปกรณ์นี้แล้ว', 'info');
  navigateApp('index.html#login');
}

/* ---------------- BOOT SEQUENCE (shared by every page) ----------------
   Handles: wait for DOM, load Firebase SDK (with CDN fallback), init
   Firebase, subscribe to school settings, apply saved theme, restore
   session. Returns true once ready, false if Firebase never loaded
   (in which case showFirebaseLoadError() has already run). */
async function bootCore(){
  const ok = await ensureFirebaseSdk();
  if (!ok){
    console.error('Firebase SDK โหลดไม่ได้จากทุก CDN');
    showFirebaseLoadError();
    return false;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    FIREBASE_READY = true;
  } catch (initErr){
    console.error('Firebase init failed:', initErr);
    showFirebaseLoadError();
    return false;
  }
  db.ref('settings').on('value', snap => { appSettings = snap.val() || appSettings; });
  initTheme();
  document.querySelectorAll('[data-theme-toggle]').forEach(t => t.addEventListener('change', e => toggleTheme(e.target.checked)));
  await resumeSession();
  return true;
}

function onCoreDomReady(fn){
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

/* ---------------- SHARED FILE HANDLING ----------------
   Compresses an uploaded image client-side (resize + JPEG) and
   returns it as a base64 data URL. Used by any module that lets
   people attach one photo without needing Firebase Storage. */
function compressImageToDataUrl(file, maxWidth, quality){
  return new Promise(function(resolve, reject){
    if (!file.type || file.type.indexOf('image/') !== 0){ reject(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ')); return; }
    var reader = new FileReader();
    reader.onerror = function(){ reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
    reader.onload = function(e){
      var img = new Image();
      img.onerror = function(){ reject(new Error('โหลดรูปภาพไม่สำเร็จ')); };
      img.onload = function(){
        var w = img.width, h = img.height;
        if (w > maxWidth){ h = Math.round(h * (maxWidth / w)); w = maxWidth; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- REPORTER INFO BLOCK (shared) ----------------
   Read-only display of the logged-in user's name + position,
   shown at the top of any "create new record" form so the person
   filling it out can see whose name it will be saved under. */
function reporterInfoHtml(){
  const name = (userProfile && userProfile.name) || '';
  const position = (userProfile && userProfile.position) || '';
  const schoolName = (appSettings && appSettings.schoolName) || 'โรงเรียนบ้านโคกม่วย สพป.หนองบัวลำภู เขต 1';
  const line = sbEsc(name) + (position ? ' ตำแหน่ง ' + sbEsc(position) : '') + ' ' + sbEsc(schoolName);
  return `<div class="sv-detail-section" style="background:var(--surface-app);padding:12px 14px;border-radius:var(--radius-sm);margin-bottom:16px;border:1px solid var(--border);">
    <p class="sv-detail-label">ผู้กรอกรายงาน</p>
    <p class="sv-detail-value">${line}</p>
  </div>`;
}
