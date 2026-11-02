/* Manuel y Natasha, RSVP. Invite only, talks to the Apps Script web app in backend/Code.gs.
   SCRIPT_URL stays empty until the script is deployed. While it is empty the page keeps the holding note. */
(function () {
  "use strict";

  /* Set to the Apps Script /exec URL from backend/SETUP.md. */
  var SCRIPT_URL = "";
  /* Hotel and airline interest flags stay hidden until those rates are confirmed. */
  var SHOW_INTEREST_FLAGS = false;

  var holding = document.getElementById("rsvp-holding");
  var app = document.getElementById("rsvp-app");
  if (!SCRIPT_URL || !app) return;

  var ERRORS = {
    not_found: "We could not find that code. Check your invitation and try again.",
    locked: "There have been too many tries for now. Please wait a little while and try again.",
    deadline_passed: "RSVPs closed on 15 January 2027. Email us if something has changed.",
    email_invalid: "Please enter an email address we can reply to.",
    missing_guest: "Please answer yes or no for every named guest.",
    too_many_guests: "There are more guests than this invitation allows.",
    over_party_size: "More people are attending than this invitation allows.",
    bad_request: "Something in the form was not quite right. Please check and try again.",
    busy: "Our system is busy. Please try again in a moment.",
    network: "We could not reach the server. Your answers are saved on this device, so please try again."
  };

  function $(id) { return document.getElementById(id); }

  var codeSection = $("rsvp-code");
  var formSection = $("rsvp-form");
  var doneSection = $("rsvp-done");
  var codeForm = $("rsvp-code-form");
  var codeInput = $("rsvp-code-input");
  var codeError = $("rsvp-code-error");
  var replyForm = $("rsvp-reply");
  var guestList = $("rsvp-guests");
  var replyError = $("rsvp-reply-error");
  var householdLine = $("rsvp-household");
  var emailInput = $("rsvp-email");
  var dietary = $("rsvp-dietary");
  var song = $("rsvp-song");
  var message = $("rsvp-message");
  var hotel = $("rsvp-hotel");
  var flight = $("rsvp-flight");
  var flags = $("rsvp-flags");
  var submitBtn = $("rsvp-submit");
  var doneBody = $("rsvp-done-body");

  var current = null;
  var rows = [];

  function showSection(name) {
    codeSection.hidden = name !== "code";
    formSection.hidden = name !== "form";
    doneSection.hidden = name !== "done";
  }

  function showError(el, text) {
    el.textContent = text;
    el.hidden = false;
  }

  function clearError(el) {
    el.textContent = "";
    el.hidden = true;
  }

  function paint(row) {
    row.yes.setAttribute("aria-pressed", String(row.answer === "yes"));
    row.no.setAttribute("aria-pressed", String(row.answer === "no"));
  }

  function choice(row, group, value, text) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-outline rsvp-choice";
    btn.textContent = text;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function () {
      row.answer = value;
      paint(row);
      saveDraft();
    });
    group.appendChild(btn);
    return btn;
  }

  function makeRow(name, answer, editable) {
    var row = { name: name, answer: answer || null, input: null };
    var wrap = document.createElement("div");
    wrap.className = "rsvp-guest";

    if (editable) {
      row.input = document.createElement("input");
      row.input.type = "text";
      row.input.className = "rsvp-input";
      row.input.placeholder = "Guest name";
      row.input.setAttribute("aria-label", "Name of an additional guest");
      row.input.value = name || "";
      wrap.appendChild(row.input);
    } else {
      var label = document.createElement("p");
      label.className = "rsvp-name";
      label.textContent = name;
      wrap.appendChild(label);
    }

    var group = document.createElement("div");
    group.className = "rsvp-toggle";
    row.yes = choice(row, group, "yes", "Dadalo / Attending");
    row.no = choice(row, group, "no", "Hindi makakadalo / Not attending");
    wrap.appendChild(group);

    paint(row);
    guestList.appendChild(wrap);
    return row;
  }

  function draftKey() {
    return "mn_rsvp_" + current.code;
  }

  function saveDraft() {
    if (!current) return;
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        answers: rows.map(function (r) { return r.answer; }),
        names: rows.map(function (r) { return r.input ? r.input.value : null; }),
        email: emailInput.value,
        dietary: dietary.value,
        song: song.value,
        message: message.value
      }));
    } catch (e) {
      /* Private browsing can block storage. The form still works without a draft. */
    }
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey()) || "null");
    } catch (e) {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey());
    } catch (e) {
      /* Nothing to clear if storage is blocked. */
    }
  }

  function applyDraft(draft) {
    if (!draft || !Array.isArray(draft.answers) || draft.answers.length !== rows.length) return;
    rows.forEach(function (row, i) {
      row.answer = draft.answers[i];
      if (row.input && typeof draft.names[i] === "string") row.input.value = draft.names[i];
      paint(row);
    });
    emailInput.value = draft.email || emailInput.value;
    dietary.value = draft.dietary || "";
    song.value = draft.song || "";
    message.value = draft.message || "";
  }

  function openForm(code, data) {
    current = { code: code };
    guestList.textContent = "";
    rows = [];
    householdLine.textContent = data.household;

    data.guests.forEach(function (g) {
      rows.push(makeRow(g.name, g.attending, false));
    });
    for (var i = 0; i < (data.open_slots || 0); i++) {
      rows.push(makeRow("", null, true));
    }

    var existing = data.existing;
    emailInput.value = data.email || "";
    dietary.value = existing ? existing.dietary || "" : "";
    song.value = existing ? existing.song || "" : "";
    message.value = existing ? existing.message || "" : "";
    if (SHOW_INTEREST_FLAGS) {
      hotel.checked = !!(existing && existing.hotel_interest);
      flight.checked = !!(existing && existing.flight_interest);
    }
    flags.hidden = !SHOW_INTEREST_FLAGS;

    submitBtn.textContent = existing ? "Update our reply" : "Send our reply";
    applyDraft(loadDraft());

    clearError(replyError);
    if (data.deadline_passed) {
      Array.prototype.forEach.call(replyForm.querySelectorAll("input, textarea, button"), function (el) {
        el.disabled = true;
      });
      showError(replyError, ERRORS.deadline_passed);
    }

    showSection("form");
  }

  function lookup(raw) {
    var code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    clearError(codeError);
    if (!code) return showError(codeError, ERRORS.not_found);

    fetch(SCRIPT_URL + "?action=lookup&code=" + encodeURIComponent(code))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) return showError(codeError, ERRORS[data.error] || ERRORS.network);
        openForm(code, data);
      })
      .catch(function () {
        showError(codeError, ERRORS.network);
      });
  }

  function collectGuests() {
    return rows
      .map(function (row) {
        return { name: row.input ? row.input.value.trim() : row.name, attending: row.answer };
      })
      .filter(function (g) { return g.name || g.attending; });
  }

  function showDone(body) {
    doneBody.textContent = "";
    body.guests.forEach(function (g) {
      var p = document.createElement("p");
      p.className = "rsvp-name";
      p.textContent = g.name + ": " + (g.attending === "yes" ? "attending" : "not attending");
      doneBody.appendChild(p);
    });
    var note = document.createElement("p");
    note.className = "caption";
    note.textContent = "A confirmation is on its way to " + body.email + ". You can change your reply until 15 January 2027.";
    doneBody.appendChild(note);
    showSection("done");
  }

  function submitReply(event) {
    event.preventDefault();
    clearError(replyError);

    if (rows.some(function (r) { return !r.input && !r.answer; })) {
      return showError(replyError, ERRORS.missing_guest);
    }
    var email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError(replyError, ERRORS.email_invalid);
    }

    var body = {
      action: "submit",
      code: current.code,
      email: email,
      guests: collectGuests(),
      dietary: dietary.value.trim(),
      song: song.value.trim(),
      message: message.value.trim(),
      hotel_interest: SHOW_INTEREST_FLAGS && hotel.checked,
      flight_interest: SHOW_INTEREST_FLAGS && flight.checked
    };

    submitBtn.disabled = true;
    fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        submitBtn.disabled = false;
        if (data.error) return showError(replyError, ERRORS[data.error] || ERRORS.bad_request);
        clearDraft();
        showDone(body);
      })
      .catch(function () {
        submitBtn.disabled = false;
        showError(replyError, ERRORS.network);
      });
  }

  holding.hidden = true;
  app.hidden = false;
  showSection("code");

  codeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    lookup(codeInput.value);
  });
  replyForm.addEventListener("submit", submitReply);
  replyForm.addEventListener("input", saveDraft);
  replyForm.addEventListener("change", saveDraft);

  var params = new URLSearchParams(window.location.search);
  if (params.get("code")) {
    codeInput.value = params.get("code");
    lookup(params.get("code"));
  }
})();
