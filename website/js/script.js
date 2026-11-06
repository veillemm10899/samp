/* =========================================================
   HOT Creation — site script
   Videos come from media/library.js (updated by update-videos.bat).
   Category names and intro lines are in CATEGORIES below.
   ========================================================= */
document.documentElement.classList.remove("no-js");

const ICONS = {
  film: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  cube: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 16 9 5 9-5M3 12l9 5 9-5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  megaphone: '<path d="m3 11 15-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  spark: '<path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (name) => `<svg class="i" aria-hidden="true" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

const CATEGORIES = [
  { id: "cinematic", name: "Realistic & Cinematic", icon: "film",
    intro: "Lifelike people, real-looking places and story-driven scenes that look shot on camera." },
  { id: "animation", name: "3D & Pixar-Style Animation", icon: "cube",
    intro: "Characters, mascots and animated stories with personality." },
  { id: "cgi", name: "CGI & Product Visuals", icon: "box",
    intro: "Detailed 3D product shots, close-ups and how-it-works visuals." },
  { id: "explainer", name: "Explainers", icon: "pen",
    intro: "Whiteboard, doodle and illustrated videos that make any idea easy to follow." },
  { id: "music", name: "Music & Song Videos", icon: "music",
    intro: "Original songs with animated or live-action visuals to match." },
  { id: "social", name: "Social Content", icon: "phone",
    intro: "Vertical videos made for TikTok, Reels and Shorts." },
  { id: "brand", name: "Brand & Promo Films", icon: "megaphone",
    intro: "Launch videos, seasonal campaigns and brand stories." },
];
const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const VIDEOS = (window.LIBRARY || []).filter((v) => catById[v.cat]);
const videoUrl = (file) => `media/videos/${file}.mp4`;
const posterUrl = (file) => `media/posters/${file}.jpg`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* =========================================================
   Hero carousel
   ========================================================= */
// featured videos first, then fill with others so the carousel always has up to 7
const HERO_COUNT = 7;
const heroItems = [...VIDEOS.filter((v) => v.featured), ...VIDEOS.filter((v) => !v.featured)].slice(0, HERO_COUNT);

const heroStage = document.getElementById("heroStage");
const heroScreen = document.getElementById("heroScreen");
const heroVideo = document.getElementById("heroVideo");
const heroNow = document.getElementById("heroNow");
const heroCount = document.getElementById("heroCount");
const heroProgress = document.getElementById("heroProgress");
const heroDots = document.getElementById("heroDots");
const heroSound = document.getElementById("heroSound");
const heroBg = document.querySelector(".hero__bg");
const heroBgPoster = document.getElementById("heroBgPoster");
const heroBgCanvas = document.getElementById("heroBgCanvas");
const heroBgCtx = heroBgCanvas.getContext("2d");
const heroTimecode = document.getElementById("heroTimecode");
const pad = (n) => String(n).padStart(2, "0");
let heroIndex = 0;
let switchTimer = null;

// one poster card per video; CSS moves them by data-pos
heroStage.insertAdjacentHTML(
  "afterbegin",
  heroItems.map((v, i) => `<button type="button" class="slide" data-i="${i}" tabindex="-1" aria-hidden="true">
      <img src="${posterUrl(v.file)}" alt="" decoding="async" /></button>`).join("")
);
const slides = [...heroStage.querySelectorAll(".slide")];

heroDots.innerHTML = heroItems
  .map((v, i) => `<button type="button" class="dot" data-go="${i}" aria-label="Play ${esc(v.title)}"></button>`)
  .join("");
const dots = [...heroDots.querySelectorAll(".dot")];

function layoutSlides() {
  const n = heroItems.length;
  slides.forEach((s, i) => {
    let d = i - heroIndex;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    s.dataset.pos = Math.max(-2, Math.min(2, d));
  });
  dots.forEach((d, k) => d.setAttribute("aria-current", String(k === heroIndex)));
}

function loadHeroVideo() {
  const cur = heroItems[heroIndex];
  heroVideo.poster = posterUrl(cur.file);
  heroVideo.src = videoUrl(cur.file);
  heroNow.textContent = `${cur.title} · ${catById[cur.cat].name}`;
  heroNow.classList.remove("is-fading");
  heroProgress.style.transform = "scaleX(0)";
  if (!reduceMotion) heroVideo.play().catch(() => {});
}

/* Hero background: the playing video, drawn tiny onto a canvas and blurred by CSS.
   While switching, the next video's poster shows (blurred) until it starts playing. */
let lastDraw = 0;
function drawBg(now) {
  requestAnimationFrame(drawBg);
  if (now - lastDraw < 33 || heroVideo.paused || heroVideo.readyState < 2) return; // ~30 fps
  lastDraw = now;
  heroBgCtx.drawImage(heroVideo, 0, 0, heroBgCanvas.width, heroBgCanvas.height);
  heroBg.classList.add("is-live");
}
if (!reduceMotion) requestAnimationFrame(drawBg);

function swapBgPoster(file) {
  heroBg.classList.remove("is-live");
  heroBgPoster.classList.add("is-fading");
  setTimeout(() => { heroBgPoster.src = posterUrl(file); heroBgPoster.classList.remove("is-fading"); }, 300);
}

function showHero(i, first = false) {
  const n = heroItems.length;
  if (!n) return;
  heroIndex = (i + n) % n;
  layoutSlides();
  heroCount.textContent = `${pad(heroIndex + 1)} / ${pad(n)}`;
  heroNow.classList.add("is-fading");
  swapBgPoster(heroItems[heroIndex].file);

  // hide the live screen while the cards slide, then bring it back on the new one
  clearTimeout(switchTimer);
  if (first || reduceMotion) { loadHeroVideo(); return; }
  heroScreen.classList.add("is-out");
  heroVideo.pause();
  switchTimer = setTimeout(() => {
    loadHeroVideo();
    heroScreen.classList.remove("is-out");
  }, 620);
}

document.querySelector(".hero__visual").addEventListener("click", (e) => {
  const step = e.target.closest("[data-step]");
  const go = e.target.closest("[data-go]");
  const slide = e.target.closest(".slide");
  if (step) showHero(heroIndex + Number(step.dataset.step));
  else if (go) showHero(Number(go.dataset.go));
  else if (slide && slide.dataset.pos !== "0") showHero(Number(slide.dataset.i));
});

heroVideo.addEventListener("ended", () => showHero(heroIndex + 1));
// if a video can't load, keep its thumbnail on screen and move on to the next one
let heroFails = 0;
heroVideo.addEventListener("playing", () => { heroFails = 0; });
heroVideo.addEventListener("error", () => {
  if (!heroVideo.getAttribute("src") || ++heroFails >= heroItems.length) return;
  setTimeout(() => showHero(heroIndex + 1), 1500);
});
heroVideo.addEventListener("timeupdate", () => {
  const t = heroVideo.currentTime;
  if (heroVideo.duration) heroProgress.style.transform = `scaleX(${t / heroVideo.duration})`;
  heroTimecode.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(Math.floor((t % 1) * 24))}`;
});
heroVideo.addEventListener("click", () => openLightbox(heroItems[heroIndex], heroVideo));

heroSound.addEventListener("click", () => {
  heroVideo.muted = !heroVideo.muted;
  heroSound.setAttribute("aria-pressed", String(!heroVideo.muted));
  heroSound.setAttribute("aria-label", heroVideo.muted ? "Turn sound on" : "Turn sound off");
  if (!heroVideo.muted) heroVideo.play().catch(() => {});
});

// swipe on touch screens
let swipeX = null;
heroStage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") swipeX = e.clientX; });
heroStage.addEventListener("pointerup", (e) => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 40) showHero(heroIndex + (dx < 0 ? 1 : -1));
});
heroStage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") showHero(heroIndex + 1);
  if (e.key === "ArrowLeft") showHero(heroIndex - 1);
});

showHero(0, true);

/* =========================================================
   What we make — editorial list with a poster that follows the pointer
   ========================================================= */
const styleList = document.getElementById("styleList");
const countLabel = (id) => {
  const n = VIDEOS.filter((v) => v.cat === id).length;
  return n ? `${n} ${n === 1 ? "film" : "films"}` : "Coming soon";
};
styleList.innerHTML =
  CATEGORIES.map((c, i) => `
    <li class="style-row reveal">
      <button class="style-row__btn" type="button" data-cat="${c.id}">
        <span class="style-row__num">${pad(i + 1)}</span>
        <span class="style-row__name">${c.name}</span>
        <span class="style-row__desc">${c.intro}<span class="style-row__count">${countLabel(c.id)}</span></span>
        <span class="style-row__arrow" aria-hidden="true">${icon("arrow")}</span>
      </button>
    </li>`).join("") +
  `<li class="style-row style-row--more reveal">
      <a class="style-row__btn" href="#contact">
        <span class="style-row__num">${pad(CATEGORIES.length + 1)}</span>
        <span class="style-row__name">Something <em>else?</em></span>
        <span class="style-row__desc">Any style, any format. If you can picture it, we can make it.</span>
        <span class="style-row__arrow" aria-hidden="true">${icon("arrow")}</span>
      </a>
   </li>`;

styleList.addEventListener("click", (e) => {
  const row = e.target.closest("[data-cat]");
  if (!row) return;
  setFilter(row.dataset.cat);
  document.getElementById("work").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
});

const peek = document.getElementById("peek");
const peekImg = peek.querySelector("img");
if (canHover && !reduceMotion) {
  let px = 0, py = 0, tx = 0, ty = 0, raf = null;
  const follow = () => {
    px += (tx - px) * 0.18; py += (ty - py) * 0.18;
    peek.style.left = `${px}px`; peek.style.top = `${py}px`;
    raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.5 ? requestAnimationFrame(follow) : null;
  };
  styleList.addEventListener("pointermove", (e) => {
    tx = e.clientX + 140; ty = e.clientY;
    if (!peek.classList.contains("is-on")) { px = tx; py = ty; }
    if (!raf) raf = requestAnimationFrame(follow);
  });
  styleList.addEventListener("pointerover", (e) => {
    const row = e.target.closest("[data-cat]");
    const first = row && VIDEOS.find((v) => v.cat === row.dataset.cat);
    if (first) { peekImg.src = posterUrl(first.file); peek.classList.add("is-on"); }
    else peek.classList.remove("is-on");
  });
  styleList.addEventListener("pointerleave", () => peek.classList.remove("is-on"));
}

/* =========================================================
   Portfolio
   ========================================================= */
const tabsEl = document.querySelector(".tabs");
const grid = document.getElementById("workGrid");
const introEl = document.getElementById("workIntro");
const emptyEl = document.getElementById("workEmpty");
const DEFAULT_INTRO = introEl.textContent;

const countFor = (id) => (id === "all" ? VIDEOS.length : VIDEOS.filter((v) => v.cat === id).length);
// short labels keep the bar on one line; the full name shows in "Now showing"
const TAB_LABEL = { all: "All work", cinematic: "Cinematic", animation: "3D Animation", cgi: "CGI", explainer: "Explainers", music: "Music", social: "Social", brand: "Brand & Promo" };
tabsEl.innerHTML = '<span class="tabs__ind" aria-hidden="true"></span>' + [{ id: "all", name: "All work" }, ...CATEGORIES]
  .map((c) => {
    const n = countFor(c.id);
    return `<button class="tab${n ? "" : " is-empty"}" role="tab" data-filter="${c.id}" aria-selected="false" aria-controls="workGrid" title="${c.name}">
      ${TAB_LABEL[c.id] || c.name}<span class="count">${n || "Soon"}</span></button>`;
  })
  .join("");
const tabInd = tabsEl.querySelector(".tabs__ind");
const navBar = document.querySelector(".nav");
const filterbar = document.getElementById("filterbar");
const workStatus = document.querySelector(".work__status");
const workCat = document.getElementById("workCat");
const workCount = document.getElementById("workCount");

// slide the gradient pill under the selected tab
function moveIndicator(animate = true) {
  const t = tabsEl.querySelector('.tab[aria-selected="true"]');
  if (!t) return;
  if (!animate) tabInd.style.transition = "none";
  tabInd.style.width = `${t.offsetWidth}px`;
  tabInd.style.transform = `translateX(${t.offsetLeft}px)`;
  if (!animate) { tabInd.offsetWidth; tabInd.style.transition = ""; }
  // keep the selected tab in view on phones
  const l = t.offsetLeft - tabsEl.clientWidth / 2 + t.offsetWidth / 2;
  tabsEl.scrollTo({ left: Math.max(0, l), behavior: animate && !reduceMotion ? "smooth" : "auto" });
}
window.addEventListener("resize", () => moveIndicator(false));
document.fonts && document.fonts.ready.then(() => moveIndicator(false));

// frosted background once the bar sticks under the menu
new IntersectionObserver(([en]) => filterbar.classList.toggle("is-stuck", en.intersectionRatio < 1 && en.boundingClientRect.top < innerHeight / 2),
  { rootMargin: `-${navBar.offsetHeight + 1}px 0px 0px 0px`, threshold: [1] }).observe(filterbar);

tabsEl.addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  setFilter(t.dataset.filter);
  // if you're deep in the grid, jump back to the start of the results
  const top = workStatus.getBoundingClientRect().top + scrollY - navBar.offsetHeight - filterbar.offsetHeight - 12;
  if (scrollY > top) window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
});
// arrow keys move between tabs
tabsEl.addEventListener("keydown", (e) => {
  if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
  const tabs = [...tabsEl.querySelectorAll(".tab")];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  next.click();
});

function cardHTML(v, i) {
  const cat = catById[v.cat];
  return `
    <button class="card" style="--i:${i}" data-index="${VIDEOS.indexOf(v)}" data-format="9:16" aria-label="Play ${esc(v.title)}">
      <span class="card__media">
        <img class="card__poster" src="${posterUrl(v.file)}" alt="" loading="lazy" decoding="async" />
        <video muted playsinline loop preload="none"></video>
        <span class="card__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg></span>
      </span>
      <span class="card__head"><span class="card__no">${pad(i + 1)}</span><span class="card__title">${esc(v.title)}</span></span>
      <span class="card__meta">${esc(v.style)} · ${cat.name} · <span class="fmt">9:16</span></span>
    </button>`;
}

// read 9:16 / 16:9 / 1:1 from the thumbnail's shape
function detectFormat(img, card) {
  const set = () => {
    const r = img.naturalWidth / img.naturalHeight;
    if (!r) return;
    const fmt = r > 1.3 ? "16:9" : r > 0.85 ? "1:1" : "9:16";
    card.dataset.format = fmt;
    card.querySelector(".fmt").textContent = fmt;
  };
  img.complete ? set() : img.addEventListener("load", set, { once: true });
}

function setFilter(id, updateUrl = true) {
  if (id !== "all" && !catById[id]) id = "all";
  // shareable link per category, e.g. index.html#work/animation
  if (updateUrl) history.replaceState(null, "", id === "all" ? "#work" : `#work/${id}`);
  tabsEl.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.filter === id;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  moveIndicator(updateUrl); // no slide on first load, just place it
  const list = id === "all" ? VIDEOS : VIDEOS.filter((v) => v.cat === id);

  // "Now showing" line
  workStatus.classList.add("is-fading");
  setTimeout(() => {
    workCat.textContent = id === "all" ? "All work" : catById[id].name;
    workCount.textContent = list.length ? `${list.length} ${list.length === 1 ? "film" : "films"}` : "Coming soon";
    workStatus.classList.remove("is-fading");
  }, reduceMotion ? 0 : 180);
  introEl.textContent = id === "all" ? DEFAULT_INTRO : catById[id].intro;
  grid.innerHTML = list.map(cardHTML).join("");
  emptyEl.hidden = list.length > 0;
  if (!list.length) document.getElementById("emptyCat").textContent = id === "all" ? "films" : catById[id].name;

  grid.querySelectorAll(".card").forEach((card) => {
    const video = card.querySelector("video");
    const item = VIDEOS[+card.dataset.index];
    detectFormat(card.querySelector(".card__poster"), card);
    if (!canHover) return;
    video.addEventListener("error", () => card.classList.remove("is-previewing"));
    card.addEventListener("mouseenter", () => {
      if (!video.src) video.src = videoUrl(item.file); // load only when first hovered
      card.classList.add("is-previewing");
      video.play().catch(() => {});
    });
    card.addEventListener("mouseleave", () => {
      card.classList.remove("is-previewing");
      video.pause();
    });
  });
}
// open the category from the link, if there is one
const fromHash = () => {
  const m = location.hash.match(/^#work\/([\w-]+)/);
  return m ? m[1] : "all";
};
setFilter(fromHash(), false);
if (fromHash() !== "all") requestAnimationFrame(() => document.getElementById("work").scrollIntoView());
window.addEventListener("hashchange", () => {
  if (!location.hash.startsWith("#work/")) return;
  setFilter(fromHash(), false);
  document.getElementById("work").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
});

// footer category links
document.getElementById("footerCats").innerHTML = CATEGORIES.map((c) => `<a href="#work/${c.id}">${c.name}</a>`).join("");

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openLightbox(VIDEOS[+card.dataset.index], card);
});

/* =========================================================
   Lightbox
   ========================================================= */
const lb = document.getElementById("lightbox");
const lbVideo = document.getElementById("lbVideo");
let lastFocus = null;

const lbMsg = document.getElementById("lbMsg");
lbVideo.addEventListener("error", () => { if (lbVideo.getAttribute("src")) lbMsg.hidden = false; });
lbVideo.addEventListener("playing", () => { lbMsg.hidden = true; });

function openLightbox(v, trigger) {
  lastFocus = trigger;
  lbMsg.hidden = true;
  heroVideo.pause();
  lbVideo.poster = posterUrl(v.file);
  lbVideo.src = videoUrl(v.file);
  document.getElementById("lbTitle").textContent = v.title;
  document.getElementById("lbSub").textContent = `${v.style} · ${catById[v.cat].name}`;
  lb.hidden = false;
  document.body.style.overflow = "hidden";
  lb.querySelector(".lightbox__close").focus();
  lbVideo.play().catch(() => {});
}
function closeLightbox() {
  lbVideo.pause();
  lbVideo.removeAttribute("src");
  lbVideo.load();
  lb.hidden = true;
  document.body.style.overflow = "";
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  const r = heroVideo.getBoundingClientRect();
  if (!reduceMotion && r.bottom > 0 && r.top < innerHeight) heroVideo.play().catch(() => {});
}
lb.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeLightbox(); });
document.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "Tab") { // keep focus inside the player
    const f = [...lb.querySelectorAll("button, video")];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* =========================================================
   Nav
   ========================================================= */
const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav__toggle");
const menu = document.getElementById("mobileMenu");
const setMenu = (open) => {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  menu.hidden = !open;
};
toggle.addEventListener("click", () => setMenu(menu.hidden));
menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); } });
window.addEventListener("resize", () => { if (window.innerWidth > 900) setMenu(false); });
const progress = document.getElementById("scrollProgress");
const onScroll = () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 8);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// logo + "Back to top": always go to the very top of the page
document.querySelectorAll(".js-top").forEach((el) =>
  el.addEventListener("click", (e) => {
    e.preventDefault();
    setMenu(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    history.replaceState(null, "", location.pathname + location.search);
  })
);

/* =========================================================
   Project brief form — opens the visitor's email app with the brief filled in
   ========================================================= */
const brief = document.getElementById("briefForm");
const studioEmail = document.getElementById("contact").dataset.email;
document.getElementById("briefTypes").innerHTML = CATEGORIES.map(
  (c) => `<label class="chip"><input type="checkbox" name="type" value="${esc(c.name)}" /><span>${c.name}</span></label>`
).join("") + `<label class="chip"><input type="checkbox" name="type" value="Something else" /><span>Something else</span></label>`;

function checkField(input, errEl, ok) {
  input.closest(".field").classList.toggle("has-error", !ok);
  input.setAttribute("aria-invalid", String(!ok));
  errEl.hidden = ok;
  return ok;
}
const bName = document.getElementById("bName");
const bEmail = document.getElementById("bEmail");
const validName = () => checkField(bName, document.getElementById("bNameErr"), bName.value.trim().length > 1);
const validEmail = () => checkField(bEmail, document.getElementById("bEmailErr"), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bEmail.value.trim()));
bName.addEventListener("blur", () => { if (bName.value) validName(); });
bEmail.addEventListener("blur", () => { if (bEmail.value) validEmail(); });

brief.addEventListener("submit", (e) => {
  e.preventDefault();
  const okName = validName(), okEmail = validEmail();
  if (!okName || !okEmail) { (okName ? bEmail : bName).focus(); return; }
  const types = [...brief.querySelectorAll('input[name="type"]:checked')].map((i) => i.value);
  const body = [
    `Name: ${bName.value.trim()}`,
    `Email: ${bEmail.value.trim()}`,
    `I'd like to make: ${types.length ? types.join(", ") : "Not sure yet"}`,
    "",
    "About the idea:",
    document.getElementById("bIdea").value.trim() || "-",
  ].join("\n");
  const url = `mailto:${studioEmail}?subject=${encodeURIComponent(`Project brief from ${bName.value.trim()}`)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  document.getElementById("briefNote").innerHTML = `Your email app should open now. If it doesn’t, write to <a class="contact__mail" href="mailto:${studioEmail}">${studioEmail}</a>.`;
});

const links = [...document.querySelectorAll(".nav__links a")];
const spy = new IntersectionObserver(
  (entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
  }),
  { rootMargin: "-45% 0px -50% 0px" }
);
["styles", "work", "process", "about", "contact"].forEach((id) => spy.observe(document.getElementById(id)));

/* =========================================================
   Headline word-by-word reveal
   ========================================================= */
function splitWords(el) {
  let d = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(" "); return; }
          const w = document.createElement("span");
          w.className = "w";
          w.innerHTML = `<span style="--d:${d++}">${esc(part)}</span>`;
          frag.append(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  walk(el);
  el.classList.add("split");
}
if (!reduceMotion) document.querySelectorAll(".hero__title, .contact__title").forEach(splitWords);

/* =========================================================
   "Play" cursor over videos (mouse only)
   ========================================================= */
if (canHover && !reduceMotion) {
  const cursor = document.getElementById("cursor");
  document.body.classList.add("has-cursor");
  document.addEventListener("pointermove", (e) => {
    cursor.style.setProperty("--x", `${e.clientX}px`);
    cursor.style.setProperty("--y", `${e.clientY}px`);
    cursor.classList.toggle("is-on", !!e.target.closest(".card, .screen video") && lb.hidden);
  }, { passive: true });
  document.addEventListener("pointerleave", () => cursor.classList.remove("is-on"));
}

/* =========================================================
   Scroll reveal + pause hero when off screen
   ========================================================= */
const revealer = new IntersectionObserver(
  (entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-in");
    revealer.unobserve(en.target);
  }),
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
  revealer.observe(el);
});

new IntersectionObserver(([en]) => {
  if (reduceMotion) return;
  en.isIntersecting && lb.hidden ? heroVideo.play().catch(() => {}) : heroVideo.pause();
}).observe(heroVideo);

document.getElementById("year").textContent = new Date().getFullYear();
