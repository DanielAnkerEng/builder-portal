// commerce/frontend/landing.mjs
var samples = [
  { title: "Rask i replikken", text: "{name}: Nevn tre ting som alltid forsvinner p\xE5 en fest. De andre teller rolig til ti. Klarte du det? Ta ett poeng." },
  { title: "Hvem i rommet?", text: "Hvem ville laget den rareste spillelisten? Alle peker samtidig. Den som f\xE5r flest stemmer, velger neste l\xE5t. Uavgjort? Velg sammen." },
  { title: "Historien g\xE5r", text: "{name} starter en historie med tre ord. G\xE5 en runde; hver person legger til tre nye ord. Avslutt s\xE5 dramatisk dere kan." }
];
function sceneCard(i) {
  return `<div class="bs-card bs-card-${i}" data-card="${i}"><div class="bs-card-turn"><div class="bs-card-face bs-card-back"><span class="bs-card-corner">Bli St\xF8gg</span><strong>Bli<br>St\xF8gg.</strong><span class="bs-card-bottom">Hele gjengen er med.</span></div><div class="bs-card-face bs-card-front"><span class="bs-card-corner">Et kort fra demospillet</span><h3>Hvem i<br>rommet?</h3><p>Hvem ville laget den rareste spillelisten?</p><p>Alle peker samtidig. Den som f\xE5r flest stemmer, velger neste l\xE5t.</p><span class="bs-card-bottom">Uavgjort? Velg sammen.</span></div></div></div>`;
}
function landingMarkup() {
  return `
<section class="bs-story" id="story" aria-labelledby="story-title" data-scene="bli-stogg-cards">
 <div class="bs-stage">
  <div class="bs-opening bs-scene-copy"><h1 id="story-title">D\xE5rlige svar.<br>God stemning.</h1><p>Drikkeleker for voksne. \xC9n skjerm, hele gjengen. Med eller uten alkohol.</p><a class="button bs-primary" href="#demo">Pr\xF8v et demospill <span aria-hidden="true">\u2197</span></a><p class="bs-small">Tre kort. Ingen innlogging.</p></div>
  <div class="bs-reading bs-scene-copy" aria-hidden="true"><h2>Hvem t\xF8r \xE5 <br>svare f\xF8rst?</h2><p>Les h\xF8yt. Pek samtidig.<br>Det finnes ingen fasit.</p><p class="bs-sr-only">Hvem ville laget den rareste spillelisten? Alle peker samtidig. Den som f\xE5r flest stemmer, velger neste l\xE5t. Uavgjort? Velg sammen.</p></div>
  <div class="bs-ending bs-scene-copy" aria-hidden="true"><h2>Samme gjeng.<br>Nytt format.</h2><p>Digitalt samles dere rundt \xE9n skjerm. <br>Med fysiske kort samles dere rundt bordet.</p><p class="bs-concept">Fysisk kortspill er et produktkonsept. <br>Utforming og innhold er ikke endelig.</p><a href="#products" class="bs-text-link">Se eksempelproduktene <span aria-hidden="true">\u2197</span></a></div>
  <div class="bs-world" aria-hidden="true">
   <div class="bs-phone"><div class="bs-phone-edge"></div><div class="bs-phone-screen"><div class="bs-camera"></div><div class="bs-phone-brand">Bli St\xF8gg<span>Demospill</span></div><div class="bs-phone-bottom"><span>Alex \xB7 Sam \xB7 Kim</span><b>Neste kort <span>\u2197</span></b><span>Poeng eller alkoholfritt. Du velger.</span></div></div></div>
   <div class="bs-card-aperture">${Array.from({ length: 5 }, (_, i) => sceneCard(i)).join("")}</div>
  </div>
  <p class="bs-scene-note">\xC9n mobil. Hele gjengen.</p>
  <a class="bs-skip-scene" href="#demo">G\xE5 rett til demoen <span aria-hidden="true">\u2193</span></a>
 </div>
 <div class="bs-static-story"><div><h2>Et kort setter<br>i gang kvelden.</h2><p>\xABHvem ville laget den rareste spillelisten?\xBB Alle peker samtidig. Den som f\xE5r flest stemmer, velger neste l\xE5t.</p></div><div><h2>Skjerm eller<br>kortstokk.</h2><p>Det digitale spillet bruker \xE9n felles skjerm. Det fysiske kortspillet er et produktkonsept for bordet. Samme sosiale id\xE9, to ulike formater.</p><a href="#products">Se eksempelproduktene</a></div></div>
</section>
<section class="bs-demo bs-section" id="demo" aria-labelledby="demo-title">
 <div class="bs-demo-intro"><h2 id="demo-title">Mindre smalltalk.<br>Mer s\xE5nn her.</h2><p>Tre kort fra pilotspillet. Samle et par venner, les h\xF8yt og se hvor det b\xE6rer.</p><noscript><p>Sl\xE5 p\xE5 JavaScript for \xE5 bruke navn og kortknapper. Eksempeloppgaven over kan leses uten.</p></noscript><details class="bs-demo-settings"><summary>Endre spillernavn <span aria-hidden="true">+</span></summary><form class="bs-demo-names"><label for="demo-names">Hvem spiller? Ett navn per linje.</label><textarea id="demo-names" rows="3" maxlength="371" disabled>Alex
Sam
Kim</textarea><button type="submit" class="button bs-primary" disabled>Bruk navnene</button><p class="bs-demo-feedback" role="status"></p></form></details><p class="bs-small">Navnene blir bare i denne fanen. Bruk poeng eller alkoholfritt. Alle kan hoppe over, uten \xE5 forklare.</p></div>
 <div class="bs-demo-game" data-ui><div class="bs-demo-counter"><span>Demospill</span><span data-demo-count>Kort 1 av 3</span></div><article class="bs-demo-card" aria-live="polite" aria-atomic="true"><span class="bs-card-corner">Bli St\xF8gg</span><h3 data-demo-title>${samples[0].title}</h3><p data-demo-text>${samples[0].text.replace("{name}", "Alex")}</p><span class="bs-card-bottom">Ingen fasit. Ingen plikt.</span></article><div class="bs-demo-actions"><button type="button" data-demo-next disabled>Neste kort <span aria-hidden="true">\u2197</span></button><button type="button" class="secondary" data-demo-skip disabled>Hopp over</button></div><p class="bs-demo-end" role="status"></p></div>
</section>
<section class="bs-how bs-section" id="how"><h2>Samle gjengen.<br>Tre enkle steg.</h2><ol><li><h3>Samle gjengen.</h3><p>To til tolv navn. \xC9n mobil, ett nettbrett eller en st\xF8rre skjerm som alle kan se.</p></li><li><h3>Les h\xF8yt.</h3><p>Ta kortene p\xE5 tur. Svar kjapt, tenk h\xF8yt eller la historien ta en helt annen retning.</p></li><li><h3>Spill p\xE5 deres m\xE5te.</h3><p>Poeng, alkoholfritt eller det dere har i glasset. Et \xABpass\xBB er alltid et helt greit svar.</p></li></ol></section>
<section class="bs-products bs-section" id="products"><div class="bs-section-heading"><h2>Skjerm eller bord.<br>Dere velger.</h2><p>Eksempelprodukter under utvikling.<br>Testpriser og produktkonsepter, ingen ekte salg.</p></div><div data-landing-products><p class="bs-catalog-message" role="status">Laster eksempelproduktene \u2026</p></div></section>
<section class="bs-about bs-section" id="about"><h2>Slipp deg l\xF8s.<br>Med gjengen.</h2><div><p class="bs-statement">Bli St\xF8gg lager en anledning til \xE5 si noe annet enn \xABhva driver du med om dagen?\xBB</p><p>Vi utvikler digitale og fysiske drikkeleker for voksne. Litt frekke sp\xF8rsm\xE5l, rare svar og god plass til \xE5 st\xE5 over. Du bestemmer selv hva som er i glasset.</p></div></section>
<section class="bs-faq bs-section" id="faq"><h2>F\xF8r dere setter i gang.</h2><div>
<details><summary>M\xE5 vi drikke alkohol?<span aria-hidden="true">+</span></summary><p>Nei. Spill med poeng, alkoholfri drikke eller bare for samtalen. Ingen oppgave krever alkohol, og alle kan hoppe over.</p></details>
<details><summary>Trenger alle sin egen mobil?<span aria-hidden="true">+</span></summary><p>Nei. F\xF8rste digitale spill er laget for \xE9n felles skjerm. Skriv inn navnene og ta kortene p\xE5 tur. Spillerrom med flere mobiler er ikke del av denne piloten.</p></details>
<details><summary>Kan vi kj\xF8pe spillene n\xE5?<span aria-hidden="true">+</span></summary><p>Dette er en lokal pilot. Produkter og priser er eksempler, Stripe er ikke koblet til, og ingen ekte betaling eller utsending kan gjennomf\xF8res.</p></details>
<details><summary>Hva er den fysiske kortstokken?<span aria-hidden="true">+</span></summary><p>Et produktkonsept. Endelig utforming, spillinnhold, pris, lager og levering er ikke bestemt.</p></details>
<details><summary>Hvor finner jeg et kj\xF8pt digitalt spill?<span aria-hidden="true">+</span></summary><p>Under Mine spill, p\xE5 kontoen som kj\xF8pte spillet. Tilgangen krever bekreftet betaling. De eksisterende demokj\xF8pene i denne lokale piloten er tydelig merket som simulerte.</p><a href="#account">G\xE5 til Mine spill</a></details>
</div></section>
<section class="bs-finale bs-section"><h2>Greit. Hvem<br>begynner?</h2><a class="button" href="#demo">Pr\xF8v et demospill <span aria-hidden="true">\u2197</span></a><p>Samme skjerm. Helt ulike svar.</p></section>`;
}
var clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
var mix = (a, b, t) => a + (b - a) * t;
var phase = (p, a, b) => clamp((p - a) / (b - a));
var blend = (a, b, t) => a.map((point, i) => point.map((v, j) => mix(v, b[i][j], t)));
function quadMap(q, W, H) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q, dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1, g = Math.abs(den) < 1e-9 ? 0 : (dx3 * dy2 - dx2 * dy3) / den, h = Math.abs(den) < 1e-9 ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
  const a = (x1 - x0 + g * x1) / W, b = (y1 - y0 + g * y1) / W, c = (x3 - x0 + h * x3) / H, d = (y3 - y0 + h * y3) / H;
  return { css: `matrix3d(${[a, b, 0, g / W, c, d, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1].map((v) => v * 1e3).join(",")})`, point: (x, y) => [(a * x + c * y + x0) / (g * x / W + h * y / H + 1), (b * x + d * y + y0) / (g * x / W + h * y / H + 1)] };
}
function plane(cx, cy, w, h, { scale = 1, x = 0, y = 0, z = 0, depth = 0 } = {}) {
  const rad = Math.PI / 180, sx = Math.sin(x * rad), cxr = Math.cos(x * rad), sy = Math.sin(y * rad), cyr = Math.cos(y * rad), sz = Math.sin(z * rad), cz = Math.cos(z * rad);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => {
    u *= scale;
    v *= scale;
    let yy = v * cxr, zz = v * sx;
    const xx = u * cyr + zz * sy;
    zz = -u * sy + zz * cyr;
    const rx = xx * cz - yy * sz, ry = xx * sz + yy * cz, f = 1400 / (1400 - zz - depth);
    return [cx + rx * f, cy + ry * f];
  });
}
function cardInPhone(mapping, i) {
  const angle = (i - 2) * 4 * Math.PI / 180, cx = 150 + (i - 2) * 4, cy = 293 + (i - 2) * 5;
  return [[-90, -127], [90, -127], [90, 127], [-90, 127]].map(([x, y]) => mapping.point(cx + x * Math.cos(angle) - y * Math.sin(angle), cy + x * Math.sin(angle) + y * Math.cos(angle)));
}
function polygon(q) {
  return `polygon(${q.map(([x, y]) => `${x.toFixed(3)}px ${y.toFixed(3)}px`).join(",")})`;
}
function mountLanding(root) {
  const story = root.querySelector(".bs-story");
  if (!story) return () => {
  };
  const stage = story.querySelector(".bs-stage"), phone = story.querySelector(".bs-phone"), aperture = story.querySelector(".bs-card-aperture"), cards = [...story.querySelectorAll(".bs-card")], turns = cards.map((c) => c.firstElementChild);
  const opening = story.querySelector(".bs-opening"), reading = story.querySelector(".bs-reading"), ending = story.querySelector(".bs-ending"), note = story.querySelector(".bs-scene-note");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let geometry, raf = 0, disposed = false, active = false, start = 0, span = 1, geometryVersion = 0, lastFrameKey;
  function setup() {
    if (disposed) return;
    const w = stage.clientWidth, h = stage.clientHeight, small = w < 700, tablet = w >= 700 && w < 1050, short = innerHeight < 620;
    active = !media.matches && !short;
    story.classList.toggle("is-motion", active);
    story.dataset.motion = active ? "scroll" : media.matches ? "reduced" : "short";
    start = story.getBoundingClientRect().top + scrollY;
    span = Math.max(1, story.offsetHeight - h);
    const phoneScale = small ? Math.min((w - 130) / 300, (h - 450) / 650, 0.59) : Math.min((h - 150) / 600, tablet ? 0.86 : 1.02);
    const phoneCenter = small ? [w * 0.6, h * 0.68] : [w * 0.72, h * (tablet ? 0.66 : 0.53)];
    const dock = plane(...phoneCenter, 300, 600, { scale: Math.max(0.4, phoneScale), x: 4, y: -13, z: small ? 6 : 8 }), mapping = quadMap(dock, 300, 600);
    const screen = [[13, 13], [287, 13], [287, 587], [13, 587]].map(([x, y]) => mapping.point(x, y));
    const sx = small ? Math.min(1, (w - 72) / 220) : 1.23;
    const fanSpecs = small ? [[0.1, 0.56, 0.65, -25, -22], [0.24, 0.53, 0.61, -18, 14], [0.52, 0.62, sx, 8, -13], [0.82, 0.54, 0.62, 25, -20], [0.92, 0.72, 0.63, 20, 25]] : [[0.18, 0.57, 0.94, -24, -18], [0.34, 0.4, 0.9, -12, 20], [0.56, 0.59, 1.25, 9, -15], [0.77, 0.37, 0.91, 19, -22], [0.87, 0.69, 0.88, 25, 22]];
    const holdSpecs = small ? [[0.07, 0.57, 0.58, -24, -20], [0.18, 0.52, 0.59, -14, 16], [0.5, 0.61, sx, 0, 0], [0.88, 0.53, 0.59, 20, -15], [0.94, 0.73, 0.56, 23, 15]] : [[0.17, 0.59, 0.88, -24, -20], [0.32, 0.43, 0.86, -12, 16], [0.53, 0.6, 1.23, 0, 0], [0.77, 0.4, 0.87, 20, -15], [0.87, 0.72, 0.8, 23, 15]];
    const pose = (spec) => plane(w * spec[0], h * spec[1], 220, 310, { scale: spec[2], z: spec[3], y: spec[4], x: 5, depth: 60 });
    const stack = cards.map((_, i) => plane(w * (small ? 0.55 : 0.71) + (i - 2) * 3, h * (small ? 0.68 : tablet ? 0.7 : 0.56) + (i - 2) * 5, 220, 310, { scale: small ? Math.min(0.92, (w - 116) / 250) : 1.3, x: 8, y: -18, z: -9, depth: 65 }));
    geometry = { w, h, small, dock, screen, starts: cards.map((_, i) => cardInPhone(mapping, i)), fan: fanSpecs.map(pose), hold: holdSpecs.map(pose), stack, phoneEnd: plane(w * (small ? 0.17 : 0.9), h * 0.67, 300, 600, { scale: small ? 0.43 : 0.64, x: 12, y: -28, z: 12 }), full: [[0, 0], [w, 0], [w, h], [0, h]] };
    geometryVersion++;
    render();
  }
  function visible(node, opacity) {
    node.style.opacity = String(opacity);
    const hidden = opacity < 0.02;
    if (hidden && node.contains(document.activeElement)) story.querySelector(".bs-skip-scene").focus({ preventScroll: true });
    node.inert = hidden;
    node.style.visibility = hidden ? "hidden" : "visible";
    node.setAttribute("aria-hidden", String(hidden));
  }
  function render() {
    raf = 0;
    if (disposed || !geometry) return;
    const { w, h, small, dock, screen, starts, fan, hold, stack, phoneEnd, full } = geometry, p = active ? clamp((scrollY - start) / span) : 0;
    const frameKey = `${p}:${geometryVersion}`;
    if (frameKey === lastFrameKey) return;
    lastFrameKey = frameKey;
    story.dataset.progress = p.toFixed(5);
    story.dataset.phase = p < 0.12 ? "opening" : p < 0.38 ? "lift" : p < 0.52 ? "turn" : p < 0.75 ? "read" : p < 0.94 ? "gather" : "deck";
    phone.style.transform = quadMap(blend(dock, phoneEnd, phase(p, 0.14, 0.8)), 300, 600).css;
    phone.style.opacity = String(1 - phase(p, 0.24, 0.66) * 0.8);
    aperture.style.clipPath = polygon(blend(screen, full, phase(p, 0.12, 0.34)));
    cards.forEach((card, i) => {
      const delay = i === 2 ? 0 : Math.abs(i - 2) * 0.012;
      let q = blend(starts[i], fan[i], phase(p, 0.12 + delay, 0.38 + delay));
      q = blend(q, hold[i], phase(p, 0.4, 0.52));
      q = blend(q, stack[i], phase(p, 0.75, 0.94));
      card.style.transform = quadMap(q, 220, 310).css;
      turns[i].style.transform = `rotateY(${i === 2 ? 180 * (phase(p, 0.38, 0.52) - phase(p, 0.75, 0.89)) : 0}deg)`;
    });
    const o = 1 - phase(p, 0.07, 0.18), r = phase(p, 0.27, 0.38) * (1 - phase(p, 0.73, 0.8)), e = phase(p, 0.8, 0.91);
    visible(opening, o);
    visible(reading, active ? r : 0);
    visible(ending, active ? e : 0);
    const noteText = p < 0.25 ? "\xC9n mobil. Hele gjengen." : p < 0.75 ? "Ta den tiden dere vil. Alle kan hoppe over." : "Fysisk kortspill \xB7 produktkonsept";
    if (note.textContent !== noteText) note.textContent = noteText;
    note.style.opacity = String(p < 0.12 ? 1 : p < 0.3 ? 1 - phase(p, 0.12, 0.22) : phase(p, 0.32, 0.4));
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(render);
  }
  let resizeFrame = 0;
  function resize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(setup);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  media.addEventListener("change", resize);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  setup();
  story.classList.add("is-ready");
  document.fonts.ready.then(() => {
    if (!disposed) resize();
  });
  let index = 0, players = ["Alex", "Sam", "Kim"], skipped = 0;
  const demo = root.querySelector(".bs-demo"), title = demo.querySelector("[data-demo-title]"), text = demo.querySelector("[data-demo-text]"), count = demo.querySelector("[data-demo-count]"), next = demo.querySelector("[data-demo-next]"), skip = demo.querySelector("[data-demo-skip]");
  function show() {
    const complete = index >= samples.length;
    count.textContent = complete ? "Demoen er ferdig" : `Kort ${index + 1} av ${samples.length}`;
    title.textContent = complete ? "Der satt stemningen." : samples[index].title;
    text.textContent = complete ? `Tre kort, ${skipped} hoppet over. Klar for en runde til?` : samples[index].text.replace("{name}", players[index % players.length]);
    next.innerHTML = complete ? "Spill igjen" : 'Neste kort <span aria-hidden="true">\u2197</span>';
    skip.disabled = complete;
    demo.querySelector(".bs-demo-end").textContent = complete ? "Dette var tre eksempler fra pilotspillet. Ingen kj\xF8p eller betaling er startet." : "";
  }
  function click(event) {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-demo-next")) {
      if (index >= samples.length) {
        index = 0;
        skipped = 0;
      } else index++;
      show();
    }
    if (b.hasAttribute("data-demo-skip") && index < samples.length) {
      skipped++;
      index++;
      show();
    }
  }
  function submit(event) {
    if (!event.target.matches(".bs-demo-names")) return;
    event.preventDefault();
    const field = demo.querySelector("#demo-names"), names = field.value.split("\n").map((n) => n.trim()).filter(Boolean), feedback = demo.querySelector(".bs-demo-feedback");
    if (names.length < 2 || names.length > 12 || names.some((n) => n.length > 30 || /[<>\x00-\x1f]/.test(n)) || new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
      field.setAttribute("aria-invalid", "true");
      feedback.textContent = "Bruk 2\u201312 ulike navn, maksimalt 30 tegn per navn.";
      return;
    }
    field.removeAttribute("aria-invalid");
    players = names;
    index = skipped = 0;
    show();
    feedback.textContent = "Navnene er klare. Les det f\xF8rste kortet h\xF8yt.";
  }
  demo.querySelectorAll("button,textarea").forEach((control) => control.disabled = false);
  demo.addEventListener("click", click);
  demo.addEventListener("submit", submit);
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(resizeFrame);
    observer.disconnect();
    media.removeEventListener("change", resize);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", resize);
    demo.removeEventListener("click", click);
    demo.removeEventListener("submit", submit);
  };
}

// commerce/frontend/shop.mjs
import { createClient } from "/vendor/supabase.js";
var main = document.querySelector("main");
var notice = document.querySelector("#notice");
var disposeLanding = mountLanding(main);
var config = await fetch("/api/config").then((r) => {
  if (!r.ok) throw Error("Konfigurasjon utilgjengelig");
  return r.json();
}).catch(() => {
  const target = main.querySelector("[data-landing-products]");
  target.innerHTML = '<p role="alert">Butikktjenesten er utilgjengelig. Demospillet fungerer fortsatt. <a href="/">Last butikken p\xE5 nytt</a>.</p>';
  document.querySelectorAll('.masthead a[href="#account"],.masthead a[href="#cart"]').forEach((a) => {
    a.href = "#products";
  });
  return null;
});
if (config) {
  let readCart = function() {
    try {
      return JSON.parse(localStorage.getItem("bli-stogg-cart") || "[]").filter((i) => typeof i.product_id === "string" && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 10);
    } catch {
      return [];
    }
  }, toast = function(text) {
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => notice.hidden = true, 6e3);
  }, persist = function(changed = true) {
    localStorage.setItem("bli-stogg-cart", JSON.stringify(cart));
    document.querySelector("#cart-link").textContent = `Handlekurv (${cart.reduce((n, i) => n + i.quantity, 0)})`;
    if (changed) sessionStorage.removeItem("bli-stogg-checkout-key");
  }, art = function(p) {
    return `<div class="product-art ${p.kind}" aria-label="Illustrert ${p.kind === "digital" ? "spillkort" : "produktutkast"}"><div class="play-card"><strong>Bli<br>St\xF8gg.</strong><span>${p.kind === "digital" ? "P\xE5 \xE9n skjerm" : "P\xE5 bordet"}<br>Hele gjengen er med.</span></div><p class="art-note">Produktkonsept \xB7 forel\xF8pig utforming</p></div>`;
  }, productRow = function(p) {
    return `<article class="product-row">${art(p)}<div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><p class="price">${money(p.unit_amount)}<small>Midlertidig testpris \xB7 ${p.kind === "digital" ? "digitalt engangskj\xF8p" : "fysisk testprodukt"}</small></p><a class="button" href="#product/${p.id}">Se ${p.kind === "digital" ? "spillet" : "testproduktet"} \u2192</a></div></article>`;
  }, head = function(title, copy = "") {
    return `<header class="page-head"><h1>${title}</h1>${copy ? `<p>${copy}</p>` : ""}</header>`;
  }, empty = function(text) {
    return `<div class="panel"><p>${text}</p><a href="#products">Se spillene \u2192</a></div>`;
  }, home = function() {
    main.classList.add("bs-home");
    if (!main.querySelector(".bs-story")) {
      main.innerHTML = landingMarkup();
      disposeLanding = mountLanding(main);
    }
    const target = main.querySelector("[data-landing-products]");
    if (products.length) target.innerHTML = products.map(productRow).join("");
  }, product = function(id) {
    const p = products.find((p2) => p2.id === id);
    if (!p) {
      main.innerHTML = empty("Produktet finnes ikke i pilotbutikken.");
      return;
    }
    main.innerHTML = head(esc(p.name), p.kind === "digital" ? "Et selskapsspill p\xE5 \xE9n felles skjerm." : "Fysisk testprodukt. Ingen utsending i piloten.") + `<div class="split">${art(p)}<div class="panel"><h2>${p.kind === "digital" ? "Klar for en runde?" : "Kort p\xE5 bordet."}</h2><p>${esc(p.description)}</p><p class="price">${money(p.unit_amount)}<small>Midlertidig testpris</small></p><button data-add="${p.id}">Legg i handlekurv</button><p class="muted">${p.kind === "digital" ? "Du m\xE5 logge inn f\xF8r testbetaling. Bekreftet betaling gir tilgang under Mine spill." : "Lager, fraktkostnad og leveringstid er ikke bestemt."}</p></div></div>`;
  }, cartRows = function() {
    return cart.map((i) => ({ i, p: products.find((p) => p.id === i.product_id) }));
  }, cartView = function() {
    const rows = cartRows();
    const blocked = rows.some(({ p }) => !p);
    const total = rows.reduce((sum, { i, p }) => sum + (p ? i.quantity * p.unit_amount : 0), 0);
    main.innerHTML = head("Handlekurven.", "Testpriser. Innhold og priser kontrolleres p\xE5 serveren f\xF8r betaling.") + (rows.length ? `<div class="split"><div class="panel">${rows.map(({ i, p }) => !p ? `<article class="cart-row"><div><h3>Utilgjengelig vare</h3><p>Fjern varen for \xE5 g\xE5 videre til betaling.</p></div><button class="text-action" data-remove="${esc(i.product_id)}">Fjern utilgjengelig vare</button></article>` : `<article class="cart-row"><div><h3>${esc(p.name)}</h3><p>${p.kind === "digital" ? "Digital tilgang" : "Fysisk testprodukt"}</p><p>${money(p.unit_amount)} per stk.</p></div><div><label for="qty-${p.id}">Antall</label><input id="qty-${p.id}" data-quantity="${p.id}" type="number" min="1" max="${p.kind === "digital" ? 1 : 10}" value="${i.quantity}"></div><button class="text-action" data-remove="${p.id}" aria-label="Fjern ${esc(p.name)}">Fjern</button></article>`).join("")}</div><div class="panel"><h2>Til betaling</h2><p class="price">${money(total)}<small>Forel\xF8pig sum \xB7 NOK</small></p><p>${config.mode === "test" ? "Stripe Checkout \xE5pnes i testmodus. Bruk bare testkort." : "Stripe-testmilj\xF8et er ikke koblet til enn\xE5. Ingen betaling kan gjennomf\xF8res."}</p>${blocked ? '<p role="status">Fjern utilgjengelige varer f\xF8r du fortsetter.</p>' : session ? '<button id="checkout">G\xE5 til Stripe-testbetaling \u2192</button>' : '<a class="button" href="#login">Logg inn for \xE5 fortsette \u2192</a>'}<p class="muted">Engangskj\xF8p pr\xF8ves i piloten. Endelig prismodell er ikke bestemt. Ingen ekte betalinger eller varer sendes.</p><div id="checkout-error" role="alert"></div></div></div>` : empty("Handlekurven er tom."));
  }, login = function() {
    main.innerHTML = head("Finn tilbake.", "Logg inn med en e-postlenke. Kj\xF8pene f\xF8lger kontoen din.") + `<form id="login-form" class="panel narrow"><h2>Din e-postadresse</h2><p>Kun syntetiske adresser i denne lokale piloten, for eksempel gjest@test.invalid. E-posten havner i den lokale testinnboksen.</p><label for="email">E-post</label><input id="email" type="email" autocomplete="email" required placeholder="gjest@test.invalid"><div class="actions"><button>Send innloggingslenke</button><a class="button secondary" href="http://127.0.0.1:56324" target="_blank" rel="noopener">\xC5pne testinnboksen</a></div><p id="login-status" role="status"></p></form>`;
  }, setup = function(id) {
    if (!session) return login();
    main.innerHTML = head("Hvem er med?", "To til tolv spillere. \xC9n felles skjerm.") + `<form id="game-setup" class="panel narrow" data-entitlement="${esc(id)}"><h2>Spillere og regler</h2><label for="players">Ett navn per linje</label><textarea id="players" required placeholder="Alex&#10;Sam"></textarea><p>Ta tur etter tur. Bruk poeng, vann eller valgfri alkoholfri drikke. Alle kan st\xE5 over uten \xE5 forklare. Ingen oppgave krever alkohol eller fysisk kontakt.</p><p>Midlertidig pilotinnhold \xB7 12 kort per runde.</p><button>Start spillet \u2192</button><p id="game-error" role="alert"></p></form>`;
  };
  const authReturn = location.hash.includes("access_token=");
  const auth = createClient(config.supabaseUrl, config.anonKey, { auth: { storageKey: "bli-stogg-buyer", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let session = (await auth.auth.getSession()).data.session, products = [], cart = readCart(), poll, renderId = 0;
  let identityVersion = 0;
  let requests = new AbortController();
  let resumableOrder;
  if (authReturn) history.replaceState(null, "", "#account");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) => new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n / 100);
  const errors = { LOCAL_MIGRATION_REQUIRED: "Butikken venter p\xE5 en lokal databaseoppdatering f\xF8r betaling kan starte.", CHECKOUT_UNCONFIRMED: "Betalingsfors\xF8ket er ikke avklart. Ingen betaling er bekreftet her. Se ordren under Mine spill, eller pr\xF8v samme handlekurv igjen.", PAYMENT_MODE_CONFLICT: "Betalingsmilj\xF8et er endret. Last siden p\xE5 nytt. Historiske demokj\xF8p gir ikke Stripe-testtilgang.", AUTH_REQUIRED: "Logg inn for \xE5 se dine kj\xF8p.", STRIPE_NOT_CONFIGURED: "Stripe-testmilj\xF8et er ikke koblet til enn\xE5. Ingen betaling er startet.", PRODUCT_UNAVAILABLE: "Et produkt er endret eller er ikke tilgjengelig. Oppdater handlekurven.", DIGITAL_QUANTITY: "Det digitale spillet kan kj\xF8pes \xE9n gang per konto.", INVALID_CART: "Handlekurven er ugyldig. Fjern varen og legg den til igjen.", ALREADY_OWNED: "Du eier allerede spillet. Du finner det under Mine spill.", INVALID_PLAYERS: "Skriv 2\u201312 ulike navn, maksimalt 30 tegn per navn.", DUPLICATE_PLAYERS: "Bruk ulike navn p\xE5 spillerne.", ROUND_CHANGED: "Runden ble endret i en annen fane. Last den inn p\xE5 nytt.", ACCESS_REQUIRED: "Denne kontoen har ikke tilgang til spillet.", NOT_FOUND: "Dette kj\xF8pet eller spillet er ikke tilgjengelig for kontoen din.", CHECKOUT_RECONCILIATION_REQUIRED: "Et tidligere betalingsfors\xF8k m\xE5 avstemmes f\xF8r du pr\xF8ver igjen. Ordren er bevart under Mine spill.", TRY_LATER: "For mange fors\xF8k. Vent ett minutt og pr\xF8v igjen." };
  async function api(path, data) {
    const signal = requests.signal;
    const current = (await auth.auth.getSession()).data.session;
    signal.throwIfAborted();
    const response = await fetch(path, {
      signal,
      method: data ? "POST" : "GET",
      headers: {
        ...current ? { Authorization: "Bearer " + current.access_token } : {},
        ...data ? { "Content-Type": "application/json" } : {}
      },
      body: data ? JSON.stringify(data) : void 0
    });
    const result = await response.json();
    signal.throwIfAborted();
    if (!response.ok) {
      const error = new Error(errors[result.error] || "Handlingen kunne ikke fullf\xF8res. Pr\xF8v igjen.");
      error.code = result.error;
      if (result.error === "OPEN_DIGITAL_ORDER" && /^[a-f0-9-]{36}$/.test(result.order_id))
        error.orderId = result.order_id;
      throw error;
    }
    return result;
  }
  const landingPages = /* @__PURE__ */ new Set(["home", "products", "demo", "how", "about", "faq", "main"]);
  const stateText = { pending: "Venter p\xE5 betalingsbekreftelse", paid: "Betaling bekreftet", failed: "Betalingen mislyktes", expired: "Betalingen utl\xF8p" };
  async function account(ticket) {
    if (!session) return login();
    const [library, orders] = await Promise.all([api("/api/library"), api("/api/orders")]);
    if (ticket !== renderId) return;
    main.innerHTML = head("Mine spill.", "Her finner du spilltilgangen og ordrene som h\xF8rer til denne kontoen.") + `<div class="actions"><a class="button secondary" href="#cart">Til handlekurven</a><button class="text-action" id="logout">Logg ut</button></div><section class="section"><h2>Spillbibliotek</h2>${library.length ? library.map((e) => `<article class="panel order-row"><div><h3>${esc(e.name)}</h3><p>Digital tilgang for denne kontoen.</p></div><a class="button" href="#setup/${e.id}">Spill \u2192</a></article>`).join("") : empty("Ingen spilltilgang enn\xE5. Tilgang kommer f\xF8rst n\xE5r betalingen er bekreftet.")}</section><section class="section"><h2>Ordrene dine</h2>${orders.length ? orders.map((o) => `<article class="panel order-row"><div><h3>${stateText[o.status]}</h3><p>${o.commerce_order_items.map((i) => esc(i.name)).join(" + ")}</p><p>${money(o.total)} \xB7 ${new Date(o.created_at).toLocaleDateString("nb-NO")}</p>${o.commerce_payments?.provider === "simulation" ? '<p class="muted">Simulert testhendelse \u2013 ikke Stripe-betaling</p>' : ""}</div><a href="#order/${o.id}">Se ordre \u2192</a></article>`).join("") : empty("Du har ingen ordre enn\xE5.")}</section>`;
  }
  async function order(id, ticket) {
    if (!session) return login();
    const o = await api("/api/orders/" + id);
    if (ticket !== renderId) return;
    if (["expired", "failed"].includes(o.status)) sessionStorage.removeItem("bli-stogg-checkout-key");
    resumableOrder = o.status === "pending" && config.mode === "test" && o.payment_provider === "stripe_test" ? o : null;
    const access = o.active_game_products?.length ? "Aktiv spilltilgang: " + o.active_game_products.map(esc).join(", ") + "." : o.status === "paid" ? "Ordren er registrert som betalt. Se gjeldende spilltilgang under Mine spill." : "Ingen spilltilgang gis f\xF8r serveren har bekreftet betaling.";
    const canceled = location.hash.includes("cancelled=1");
    main.innerHTML = head("Din ordre.", stateText[o.status]) + `<div class="panel narrow"><p class="status">${stateText[o.status]}</p>${canceled && o.status === "pending" ? "<p>Du avbr\xF8t Checkout. Ordren er fortsatt ubetalt. Et avbrutt nettleserbes\xF8k bekrefter ingen betaling.</p>" : ""}${o.commerce_payments?.provider === "simulation" ? '<p class="status">Simulert testhendelse. Ingen betaling er gjennomf\xF8rt hos Stripe.</p>' : ""}<h2>Dette ligger i ordren</h2>${o.commerce_order_items.map((i) => `<p>${esc(i.name)} \xD7 ${i.quantity} \xB7 ${money(i.unit_amount * i.quantity)}</p>`).join("")}<p class="price">${money(o.total)}</p><p>${access}</p>${o.fulfillment !== "not_required" ? "<p>Fysisk levering: " + (o.fulfillment === "awaiting_payment" ? "venter p\xE5 betaling." : "testordre, ikke sendt.") + "</p>" : ""}<div class="actions"><a class="button" href="#account">Mine spill og kj\xF8p \u2192</a><button class="secondary" id="refresh">Oppdater status</button>${resumableOrder ? '<button id="resume-checkout">Fortsett med denne ordren \u2192</button>' : ""}</div></div>`;
    if (o.status === "pending") poll = setTimeout(() => route(false), 6e3);
  }
  async function game(id, ticket) {
    const g = await api("/api/game/" + id);
    if (ticket !== renderId) return;
    main.innerHTML = `<div class="game-shell">${head(g.complete ? "Takk for runden." : "St\xF8gg p\xE5 skjerm.")}<div class="game-progress"><span>${g.complete ? "Runden er ferdig" : `Kort ${g.position + 1} av ${g.total}`}</span><span>${g.players.map(esc).join(" \xB7 ")}</span></div><article class="game-card">${g.complete ? `<h2>Samme gjeng.<br>En runde til?</h2><p>${g.endedEarly ? "Runden ble avsluttet f\xF8r alle kortene var vist." : `Dere gikk gjennom ${g.total} kort. ${g.skipped} ble hoppet over.`} H\xE5per dere fant noe \xE5 le av.</p>` : `<h2>${esc(g.card.title)}</h2><p>${esc(g.card.text)}</p>`}</article>${g.complete ? '<div class="actions"><a class="button" href="#account">Start en ny runde \u2192</a></div>' : `<div class="game-actions"><button data-game="next" data-id="${g.id}" data-version="${g.version}">Neste kort \u2192</button><button class="secondary" data-game="skip" data-id="${g.id}" data-version="${g.version}">Hopp over</button><button class="text-action" data-game="end" data-id="${g.id}" data-version="${g.version}">Avslutt</button></div>`}<p class="muted">Poeng og alkoholfritt fungerer like godt. Alle kan hoppe over.</p></div>`;
  }
  async function route(focus = true) {
    clearTimeout(poll);
    resumableOrder = null;
    const ticket = ++renderId;
    const [page, id] = (location.hash.slice(1) || "home").split("/");
    const isLanding = landingPages.has(page) || !["product", "cart", "login", "account", "order", "setup", "game"].includes(page);
    try {
      if (isLanding) {
        home();
        if (!products.length) {
          try {
            products = (await api("/api/catalog")).products;
            if (ticket !== renderId) return;
            home();
          } catch (e) {
            if (ticket !== renderId) return;
            main.querySelector("[data-landing-products]").innerHTML = `<p role="alert">Eksempelproduktene kunne ikke lastes. Demospillet fungerer fortsatt.</p><button id="refresh">Pr\xF8v igjen</button>`;
          }
        }
        if (focus) {
          const target = main.querySelector("#" + page);
          if (target) {
            target.scrollIntoView();
            target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
          } else {
            window.scrollTo(0, 0);
            main.focus({ preventScroll: true });
          }
        }
        return;
      }
      disposeLanding?.();
      disposeLanding = null;
      main.classList.remove("bs-home");
      if (!products.length || page === "cart") {
        const fresh = await api("/api/catalog");
        if (ticket !== renderId) return;
        products = fresh.products;
      }
      if (ticket !== renderId) return;
      if (page === "product") product(id);
      else if (page === "cart") cartView();
      else if (page === "login") login();
      else if (page === "account") await account(ticket);
      else if (page === "order") await order(id?.split("?")[0], ticket);
      else if (page === "setup") setup(id);
      else if (page === "game") await game(id, ticket);
      else {
        home();
      }
      if (focus) {
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
      }
    } catch (e) {
      if (ticket !== renderId) return;
      main.innerHTML = head("Det stoppet opp.") + `<div class="panel"><p role="alert">${esc(e.message)}</p><button id="refresh">Pr\xF8v igjen</button> <a href="#account">Mine spill</a></div>`;
    }
  }
  main.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || b.closest(".bs-demo")) return;
    const identity = identityVersion;
    try {
      if (b.dataset.add) {
        const p = products.find((p2) => p2.id === b.dataset.add), existing = cart.find((i) => i.product_id === p.id);
        if (existing) {
          if (p.kind === "physical") existing.quantity = Math.min(10, existing.quantity + 1);
        } else cart.push({ product_id: p.id, quantity: 1 });
        persist();
        toast("Lagt i handlekurven.");
        return;
      }
      if (b.dataset.remove) {
        cart = cart.filter((i) => i.product_id !== b.dataset.remove);
        persist();
        cartView();
        return;
      }
      if (b.id === "refresh") return route(false);
      if (b.id === "logout") {
        await auth.auth.signOut();
        return;
      }
      if (b.id === "checkout" || b.id === "resume-checkout") {
        let input;
        if (b.id === "resume-checkout") {
          if (!resumableOrder) return;
          input = { request_key: resumableOrder.request_key, items: resumableOrder.cart };
        } else {
          const rows = cartRows();
          if (!rows.length || rows.some(({ p }) => !p)) return cartView();
          let key = sessionStorage.getItem("bli-stogg-checkout-key");
          if (!key) {
            key = crypto.randomUUID();
            sessionStorage.setItem("bli-stogg-checkout-key", key);
          }
          input = { request_key: key, items: rows.map(({ i }) => i) };
        }
        b.disabled = true;
        const result = await api("/api/checkout", input);
        if (identity !== identityVersion) return;
        if (result.url) location.assign(result.url);
        else location.hash = "order/" + result.order_id;
      }
      if (b.dataset.game) {
        b.disabled = true;
        await api("/api/game/" + b.dataset.id, { version: Number(b.dataset.version), action: b.dataset.game });
        await route(false);
      }
    } catch (err) {
      if (identity !== identityVersion) return;
      if (err.code === "PRODUCT_UNAVAILABLE" && location.hash === "#cart") await route(false);
      if (identity !== identityVersion) return;
      const target = document.querySelector("#checkout-error");
      if (err.orderId && target) {
        const link = document.createElement("a");
        link.href = "#order/" + err.orderId;
        link.textContent = "\xC5pne den ventende ordren";
        target.replaceChildren("Spillet ligger allerede i en ventende ordre. ", link);
        return;
      }
      if (target) {
        target.className = "error";
        target.textContent = err.message;
      } else toast(err.message);
    } finally {
      b.disabled = false;
    }
  });
  main.addEventListener("change", (e) => {
    const id = e.target.dataset.quantity;
    if (!id) return;
    const qty = Number(e.target.value), p = products.find((p2) => p2.id === id);
    if (!Number.isInteger(qty) || qty < 1 || qty > (p.kind === "digital" ? 1 : 10)) {
      toast("Velg et gyldig antall.");
      cartView();
      return;
    }
    cart.find((i) => i.product_id === id).quantity = qty;
    persist();
    cartView();
  });
  main.addEventListener("submit", async (e) => {
    if (!["login-form", "game-setup"].includes(e.target.id)) return;
    e.preventDefault();
    const identity = identityVersion, form = e.target, b = form.querySelector("button");
    b.disabled = true;
    try {
      if (form.id === "login-form") {
        const email = form.querySelector("#email").value.trim();
        if (!email.endsWith("@test.invalid")) throw Error("Bruk bare en syntetisk @test.invalid-adresse i piloten.");
        const { error } = await auth.auth.signInWithOtp({ email, options: { emailRedirectTo: config.shopOrigin + "/" } });
        if (error) throw Error("Lenken kunne ikke sendes. Vent litt og pr\xF8v igjen.");
        form.querySelector("#login-status").textContent = "Lenken er sendt til den lokale testinnboksen. \xC5pne den for \xE5 logge inn.";
      }
      if (form.id === "game-setup") {
        const g = await api("/api/game", { entitlement_id: form.dataset.entitlement, players: form.querySelector("#players").value.split("\n").map((v) => v.trim()).filter(Boolean) });
        location.hash = "game/" + g.id;
      }
    } catch (err) {
      if (identity !== identityVersion) return;
      const target = form.querySelector('[role="alert"],[role="status"]');
      target.textContent = err.message;
    } finally {
      b.disabled = false;
    }
  });
  auth.auth.onAuthStateChange((event, nextSession) => {
    const changed = session?.user?.id !== nextSession?.user?.id;
    session = nextSession;
    if (!changed) return;
    identityVersion++;
    renderId++;
    requests.abort();
    requests = new AbortController();
    clearTimeout(poll);
    resumableOrder = null;
    notice.hidden = true;
    notice.textContent = "";
    sessionStorage.removeItem("bli-stogg-checkout-key");
    const page = location.hash.slice(1).split("/")[0];
    if (!main.classList.contains("bs-home")) main.replaceChildren();
    if (["account", "order", "game", "setup", "login"].includes(page) || location.hash.includes("access_token=")) {
      main.replaceChildren();
      history.replaceState(null, "", nextSession ? "#account" : "#login");
    }
    setTimeout(() => route(false), 0);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest('a[href="#home"]') && location.hash === "#home") {
      event.preventDefault();
      route();
    }
  });
  const restoring = performance.getEntriesByType("navigation")[0]?.type === "reload";
  window.addEventListener("hashchange", () => route());
  persist(false);
  await route(Boolean(location.hash) && !restoring);
}
