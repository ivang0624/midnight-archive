(function () {
  var SLOW_MS = 170;
  var canvas = document.getElementById("particles");
  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mouseNorm = { x: 0.5, y: 0.5 };
  var mouseSmooth = { x: 0.5, y: 0.5 };

  function afterSpace(fn) {
    window.setTimeout(fn, SLOW_MS);
  }

  if (!reducedMotion) {
    document.addEventListener(
      "mousemove",
      function (e) {
        mouseNorm.x = e.clientX / Math.max(1, window.innerWidth);
        mouseNorm.y = e.clientY / Math.max(1, window.innerHeight);
      },
      { passive: true }
    );
  }

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initParticles() {
    particles.length = 0;
    var area = window.innerWidth * window.innerHeight;
    var count = Math.min(95, Math.max(32, Math.floor(area / 28000)));
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 0.45 + 0.06,
        vx: (Math.random() - 0.5) * 0.018,
        vy: (Math.random() - 0.5) * 0.018,
        o: Math.random() * 0.1 + 0.02,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.00006 + Math.random() * 0.00009,
        depth: 0.35 + Math.random() * 0.65
      });
    }
  }

  function tick(t) {
    if (reducedMotion) return;
    var prev = tick._last;
    tick._last = t;
    var dt = prev != null ? Math.min(64, t - prev) : 16;
    var w = window.innerWidth;
    var h = window.innerHeight;
    mouseSmooth.x += (mouseNorm.x - mouseSmooth.x) * 0.028;
    mouseSmooth.y += (mouseNorm.y - mouseSmooth.y) * 0.028;
    var mx = mouseSmooth.x * w;
    var my = mouseSmooth.y * h;
    var parallaxX = (mouseSmooth.x - 0.5) * 24;
    var parallaxY = (mouseSmooth.y - 0.5) * 18;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var pull = 2.4e-6 * p.depth;
      p.vx += (mx - p.x) * pull;
      p.vy += (my - p.y) * pull;
      p.vx *= 0.9986;
      p.vy *= 0.9986;
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += p.pulseSpeed * dt;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
      var flicker = 0.94 + Math.sin(p.pulse) * 0.06;
      var px = p.x + parallaxX * (0.2 + p.depth * 0.75);
      var py = p.y + parallaxY * (0.2 + p.depth * 0.75);
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(226, 234, 248, " + (p.o * flicker) + ")";
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  resize();
  initParticles();
  window.addEventListener("resize", function () {
    resize();
    initParticles();
  });

  if (!reducedMotion) {
    requestAnimationFrame(tick);
  }

  /* Optional ambient: filtered noise + low hum (Web Audio, user toggle) */
  var ambient = { ctx: null, master: null, started: false };
  function buildAmbient() {
    if (ambient.ctx) return true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    ambient.ctx = new Ctx();
    ambient.master = ambient.ctx.createGain();
    ambient.master.gain.value = 0;
    var sr = ambient.ctx.sampleRate;
    var bs = Math.floor(sr * 2);
    var buf = ambient.ctx.createBuffer(1, bs, sr);
    var data = buf.getChannelData(0);
    for (var j = 0; j < bs; j++) {
      data[j] = Math.random() * 2 - 1;
    }
    var src = ambient.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var lp = ambient.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 280;
    lp.Q.value = 0.6;
    src.connect(lp);
    lp.connect(ambient.master);
    var osc = ambient.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 51;
    var og = ambient.ctx.createGain();
    og.gain.value = 0.055;
    osc.connect(og);
    og.connect(ambient.master);
    ambient.master.connect(ambient.ctx.destination);
    src.start();
    osc.start();
    ambient.started = true;
    return true;
  }

  function setAmbientActive(active) {
    if (!buildAmbient() || !ambient.ctx || !ambient.master) return;
    ambient.ctx.resume();
    var now = ambient.ctx.currentTime;
    var g = ambient.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    if (active) {
      g.linearRampToValueAtTime(0.032, now + 2.1);
    } else {
      g.linearRampToValueAtTime(0, now + 1.35);
    }
  }

  var soundToggle = document.getElementById("soundToggle");
  var soundOn = false;
  if (soundToggle) {
    soundToggle.addEventListener("click", function () {
      if (!soundOn) {
        if (!buildAmbient()) return;
        setAmbientActive(true);
        soundOn = true;
        soundToggle.textContent = "MUTE";
        soundToggle.setAttribute("aria-pressed", "true");
        soundToggle.setAttribute("aria-label", "Mute ambient sound");
      } else {
        setAmbientActive(false);
        soundOn = false;
        soundToggle.textContent = "ENTER SOUND";
        soundToggle.setAttribute("aria-pressed", "false");
        soundToggle.setAttribute("aria-label", "Enable ambient sound");
      }
    });
  }

  var entranceEl = document.getElementById("view-entrance");
  var exhibitionEl = document.getElementById("view-exhibition");
  var entryBtn = document.getElementById("entryBtn");
  var foyerBtn = document.getElementById("foyerBtn");
  var tabs = document.querySelectorAll(".section-tab");
  var panels = document.querySelectorAll(".section-panel");
  var panelsRoot = document.querySelector(".section-panels");
  var enterFx = document.getElementById("room-enter-fx");
  var enterFlash = enterFx ? enterFx.querySelector(".room-enter-fx__flash") : null;
  var roomBootLock = false;
  var firstSectionTab = document.getElementById("tab-s-1");

  function clearRoomBoot() {
    roomBootLock = false;
    document.documentElement.classList.remove("room-boot");
    if (enterFx) enterFx.classList.remove("is-on");
  }

  function playRoomBootThen(fn) {
    if (reducedMotion || !enterFx || !enterFlash) {
      fn();
      return;
    }
    if (roomBootLock) return;
    roomBootLock = true;
    document.documentElement.classList.add("room-boot");
    enterFx.classList.add("is-on");
    requestAnimationFrame(function () {
      requestAnimationFrame(fn);
    });
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      enterFlash.removeEventListener("animationend", onAnimEnd);
      clearRoomBoot();
    }
    function onAnimEnd(ev) {
      if (ev.target !== enterFlash) return;
      finish();
    }
    enterFlash.addEventListener("animationend", onAnimEnd);
    window.setTimeout(finish, 1750);
  }

  function showEntrance() {
    entranceEl.classList.remove("is-hidden");
    entranceEl.removeAttribute("inert");
    entranceEl.removeAttribute("aria-hidden");
    exhibitionEl.classList.add("is-hidden");
    exhibitionEl.setAttribute("hidden", "");
    exhibitionEl.setAttribute("inert", "");
    exhibitionEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-exhibition");
  }

  function showExhibition() {
    entranceEl.classList.add("is-hidden");
    entranceEl.setAttribute("inert", "");
    entranceEl.setAttribute("aria-hidden", "true");
    exhibitionEl.classList.remove("is-hidden");
    exhibitionEl.removeAttribute("hidden");
    exhibitionEl.removeAttribute("inert");
    exhibitionEl.removeAttribute("aria-hidden");
    document.body.classList.add("is-exhibition");
  }

  function setSection(sectionId) {
    var id = String(sectionId);
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-section") === id;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (panel) {
      var on = panel.getAttribute("data-section") === id;
      panel.classList.toggle("is-active", on);
      if (on) {
        panel.removeAttribute("aria-hidden");
        panel.removeAttribute("inert");
      } else {
        panel.setAttribute("aria-hidden", "true");
        panel.setAttribute("inert", "");
      }
    });
    var activePanel = document.querySelector(".section-panel.is-active");
    if (activePanel && panelsRoot) {
      panelsRoot.appendChild(activePanel);
    }
  }

  function applyHash() {
    var h = location.hash;
    var m = /^#section-([123])$/.exec(h);
    var legacy = /^#room-([123])$/.exec(h);
    if (m || legacy) {
      var sid = (m || legacy)[1];
      showExhibition();
      setSection(sid);
      if (legacy) {
        try {
          history.replaceState(null, "", "#section-" + sid);
        } catch (e) {}
      }
      return;
    }
    showEntrance();
  }

  entryBtn.addEventListener("click", function () {
    afterSpace(function () {
      playRoomBootThen(function () {
        showExhibition();
        setSection("1");
        try {
          history.replaceState(null, "", "#section-1");
        } catch (e) {}
        if (firstSectionTab) {
          firstSectionTab.focus();
        }
      });
    });
  });

  foyerBtn.addEventListener("click", function () {
    afterSpace(function () {
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) {}
      showEntrance();
      entryBtn.focus();
    });
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-section");
      if (!id || tab.classList.contains("is-active")) return;
      afterSpace(function () {
        playRoomBootThen(function () {
          setSection(id);
          try {
            history.replaceState(null, "", "#section-" + id);
          } catch (e) {}
        });
      });
    });
  });

  window.addEventListener("hashchange", applyHash);
  applyHash();
})();
