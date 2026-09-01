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
