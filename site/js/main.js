/* Manuel y Natasha — shared behaviour
   Countdown to the ceremony, reveal on scroll. Respects reduced motion. */

(function () {
  "use strict";

  /* Ceremony moment: 10 April 2027, 4:00pm, Manila (UTC+8), no DST in PH */
  var CEREMONY = new Date("2027-04-10T16:00:00+08:00");

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function tickCountdown() {
    var el = document.querySelector("[data-countdown]");
    if (!el) return;

    var days = el.querySelector("[data-days]");
    var hours = el.querySelector("[data-hours]");
    var mins = el.querySelector("[data-mins]");
    var secs = el.querySelector("[data-secs]");

    function update() {
      var diff = CEREMONY.getTime() - Date.now();
      if (diff <= 0) {
        days.textContent = "0";
        hours.textContent = "00";
        mins.textContent = "00";
        secs.textContent = "00";
        return;
      }
      var s = Math.floor(diff / 1000);
      days.textContent = String(Math.floor(s / 86400));
      hours.textContent = pad(Math.floor((s % 86400) / 3600));
      mins.textContent = pad(Math.floor((s % 3600) / 60));
      secs.textContent = pad(s % 60);
    }

    update();
    setInterval(update, 1000);
  }

  function localTimeLine() {
    var el = document.querySelector("[data-localtime]");
    if (!el) return;
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (zone === "Asia/Manila") {
        el.textContent = "Four in the afternoon, Manila time";
        return;
      }
      var fmt = new Intl.DateTimeFormat(undefined, {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "numeric", minute: "2-digit"
      });
      el.textContent = "In your time, " + fmt.format(CEREMONY);
    } catch (e) {
      el.textContent = "";
    }
  }

  function reveals() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (i) { i.classList.add("revealed"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    items.forEach(function (i) { io.observe(i); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    tickCountdown();
    localTimeLine();
    reveals();
  });
})();

/* Background music, opt in. Off until a guest presses the button.
   The choice, track and position are remembered so it carries across pages. */
(function () {
  "use strict";

  var script = document.currentScript;
  var base = script ? script.src.replace(/js\/main\.js.*$/, "") : "../";
  var tracks = [
    base + "assets/music/rondang-ng-araw.mp3",
    base + "assets/music/pangako-ng-araw.mp3"
  ];
  var KEY_ON = "mn_music_on", KEY_TRACK = "mn_music_track", KEY_TIME = "mn_music_time";

  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }

  var index = parseInt(get(KEY_TRACK), 10);
  if (isNaN(index) || index < 0 || index >= tracks.length) index = 0;

  var audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.55;
  audio.src = tracks[index];

  var btn;
  var lastSave = 0;

  function paint(on) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "Pause background music" : "Play background music");
    btn.querySelector(".music-state").textContent = on ? "On" : "Off";
    btn.classList.toggle("is-on", on);
  }

  function save() {
    set(KEY_TRACK, String(index));
    set(KEY_TIME, String(audio.currentTime || 0));
  }

  function play() {
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { set(KEY_ON, "1"); paint(true); })
       .catch(function () { paint(false); });
    } else {
      set(KEY_ON, "1"); paint(true);
    }
    return p;
  }

  function pause() {
    audio.pause();
    set(KEY_ON, "0");
    save();
    paint(false);
  }

  audio.addEventListener("ended", function () {
    index = (index + 1) % tracks.length;
    audio.src = tracks[index];
    set(KEY_TIME, "0");
    play();
  });

  audio.addEventListener("timeupdate", function () {
    var now = Date.now();
    if (now - lastSave > 1000) { lastSave = now; save(); }
  });
  window.addEventListener("pagehide", save);

  function build() {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-toggle";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
      '<path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="6.5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<circle cx="16.5" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<span class="music-label">Musika</span><span class="music-state">Off</span>';
    btn.addEventListener("click", function () {
      if (audio.paused) { play(); } else { pause(); }
    });
    document.body.appendChild(btn);
    paint(false);

    if (get(KEY_ON) === "1") {
      var t = parseFloat(get(KEY_TIME));
      if (!isNaN(t) && t > 0) {
        audio.addEventListener("loadedmetadata", function seek() {
          audio.removeEventListener("loadedmetadata", seek);
          if (t < audio.duration - 1) audio.currentTime = t;
        });
      }
      var p = audio.play();
      if (p && p.then) {
        p.then(function () { paint(true); }).catch(function () {
          /* Browser blocked resuming on a fresh page. The guest chose music on,
             so pick it up on their first tap or key press. */
          paint(false);
          var resume = function () {
            document.removeEventListener("pointerdown", resume, true);
            document.removeEventListener("keydown", resume, true);
            if (get(KEY_ON) === "1" && audio.paused) play();
          };
          document.addEventListener("pointerdown", resume, true);
          document.addEventListener("keydown", resume, true);
        });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", build);
})();
