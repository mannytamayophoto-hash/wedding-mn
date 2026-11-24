/* RSVP form. One link for everyone, replies go to the Google Sheet through Apps Script. */
(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbzGGc2x7Q8NebJz-CmXuJ5ZYKRfWA301gYFOuo1TAr-tNd-l9UzxFN8bPAJ9bm1XvmNdQ/exec';
  var CUTOFF = new Date('2027-01-15T23:59:00+08:00');
  var DRAFT_KEY = 'mn_rsvp_draft';
  var HOTEL_TO = 'reservations@diamondhotel.com';
  var HOTEL_CC = 'pmanalastas@diamondhotel.com,manuelynatashatamayo@gmail.com';
  var HOTEL_REF = "Tamayo's Wedding, April 10, 2027";

  var form = document.getElementById('rsvp-form');
  if (!form) return;

  var thanks = document.getElementById('thanks');
  var thanksText = document.getElementById('thanks-text');
  var closed = document.getElementById('closed');
  var errorBox = document.getElementById('form-error');
  var sendBtn = document.getElementById('send-btn');
  var attendingOnly = form.querySelector('.attending-only');
  var guest2 = document.getElementById('f-guest2');
  var extraBox = document.getElementById('f-extra');
  var extraFields = document.getElementById('extra-fields');
  var hotelBox = document.getElementById('f-hotel');
  var hotelFields = document.getElementById('hotel-fields');
  var hotelMail = document.getElementById('hotel-mail');
  var demo = /[?&]demo=1/.test(location.search);
  var apiReady = API_URL.indexOf('PASTE_') !== 0;

  function $(id) { return document.getElementById(id); }
  function val(id) { return ($(id).value || '').trim(); }
  function attending() { return form.querySelector('input[name="attending"]:checked').value; }

  function showClosed() {
    form.hidden = true;
    thanks.hidden = true;
    closed.hidden = false;
    closed.scrollIntoView({ block: 'start' });
  }

  function showThanks(isYes) {
    form.hidden = true;
    thanksText.textContent = isYes
      ? 'We’ve received your RSVP and will be in touch by 31 January 2027 to confirm.'
      : 'Thank you for letting us know. You’ll be missed.';
    thanks.hidden = false;
    thanks.focus();
    thanks.scrollIntoView({ block: 'start' });
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'center' });
  }

  function clearErrors() {
    errorBox.hidden = true;
    errorBox.textContent = '';
    Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (n) { n.remove(); });
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (n) { n.removeAttribute('aria-invalid'); });
  }

  function fieldError(id, msg) {
    var el = $(id);
    el.setAttribute('aria-invalid', 'true');
    var p = document.createElement('p');
    p.className = 'field-error';
    p.textContent = msg;
    var host = el.closest('.field') || el.parentNode;
    host.appendChild(p);
    el.focus();
    return false;
  }

  /* Showing and hiding */

  function syncAttending() {
    var yes = attending() === 'yes';
    attendingOnly.hidden = !yes;
  }

  function syncSeats() {
    var two = val('f-seats') === '2';
    guest2.hidden = !two;
    guest2.required = false;
  }

  function syncExtra() { extraFields.hidden = !extraBox.checked; }
  function syncHotel() { hotelFields.hidden = !hotelBox.checked; updateHotelMail(); }

  function guestList() {
    var g = [val('f-guest1')];
    if (val('f-seats') === '2') g.push(val('f-guest2'));
    return g.filter(String);
  }
  function fullPhone() {
    var code = val('f-code');
    var num = val('f-phone').replace(/^0+/, '');
    return (code ? code + ' ' : '') + num;
  }

  function updateHotelMail() {
    var lines = [
      'Hello,',
      '',
      'I would like to book a room at the wedding rate for ' + HOTEL_REF + '.',
      '',
      'Name: ' + val('f-name'),
      'Guests: ' + guestList().join(', '),
      'Rooms: ' + val('f-rooms'),
      'Room type: ' + val('f-roomtype'),
      'Check in: ' + val('f-checkin'),
      'Check out: ' + val('f-checkout'),
      'Mobile: ' + fullPhone(),
      '',
      'Please let me know the special rate and how to pay.',
      '',
      'Thank you'
    ];
    var href = 'mailto:' + HOTEL_TO +
      '?cc=' + encodeURIComponent(HOTEL_CC) +
      '&subject=' + encodeURIComponent('Room booking, ' + HOTEL_REF) +
      '&body=' + encodeURIComponent(lines.join('\r\n'));
    hotelMail.setAttribute('href', href);
  }

  /* Draft autosave */

  function saveDraft() {
    try {
      var d = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.name === 'website') return;
        if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
        else if (el.type === 'checkbox') { d[el.name] = el.checked; }
        else { d[el.name] = el.value; }
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* storage can be blocked, ignore */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || !(el.name in d) || el.name === 'website') return;
        if (el.type === 'radio') { el.checked = (el.value === d[el.name]); }
        else if (el.type === 'checkbox') { el.checked = !!d[el.name]; }
        else { el.value = d[el.name]; }
      });
    } catch (e) { /* ignore */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  /* Validation */

  function validate() {
    clearErrors();
    var yes = attending() === 'yes';
    if (!val('f-name')) return fieldError('f-name', 'Please add your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('f-email'))) return fieldError('f-email', 'Please add a valid email address, we send your copy there.');
    if (val('f-phone').replace(/\D/g, '').length < 6) return fieldError('f-phone', 'Please add your mobile number, at least 6 digits.');
    if (yes) {
      if (!val('f-guest1')) return fieldError('f-guest1', 'Please add the name of each guest.');
      if (val('f-seats') === '2' && !val('f-guest2')) return fieldError('f-guest2', 'Please add the name of your second guest, or choose 1 attendee.');
      if (extraBox.checked && !val('f-extra-details')) return fieldError('f-extra-details', 'Please tell us how many more seats, and who.');
    }
    return true;
  }

  function payload() {
    var yes = attending() === 'yes';
    var p = {
      action: 'submit',
      attending: attending(),
      name: val('f-name'),
      email: val('f-email'),
      phone: fullPhone(),
      message: val('f-message'),
      website: val('f-website')
    };
    if (yes) {
      p.seats = parseInt(val('f-seats'), 10);
      p.guests = guestList();
      p.country = val('f-country');
      p.dietary = val('f-dietary');
      p.extraSeats = extraBox.checked;
      p.extraDetails = extraBox.checked ? val('f-extra-details') : '';
      p.hotel = hotelBox.checked;
      if (hotelBox.checked) {
        p.rooms = val('f-rooms');
        p.roomType = val('f-roomtype');
        p.checkIn = val('f-checkin');
        p.checkOut = val('f-checkout');
      }
    }
    return p;
  }

  var messages = {
    closed: null,
    server_busy: 'We are getting a lot of replies right now. Please try again in a few minutes.',
    bad_request: 'Something went wrong with that reply. Please check the form and try again.',
    missing: 'Please check the highlighted field and try again.'
  };

  var fieldIds = { name: 'f-name', email: 'f-email', phone: 'f-phone', guests: 'f-guest1' };

  function submit(e) {
    e.preventDefault();
    if (new Date() > CUTOFF) { showClosed(); return; }
    if (!validate()) return;

    if (!apiReady) {
      if (demo) { showThanks(attending() === 'yes'); return; }
      showError('RSVP opens very soon. Please check back in a day or two, or email manuelynatashatamayo@gmail.com.');
      return;
    }

    sendBtn.disabled = true;
    var label = sendBtn.textContent;
    sendBtn.textContent = 'Sending';

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload())
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          var yes = attending() === 'yes';
          clearDraft();
          showThanks(yes);
          return;
        }
        if (res && res.error === 'closed') { showClosed(); return; }
        if (res && res.error === 'missing' && fieldIds[res.field]) {
          fieldError(fieldIds[res.field], messages.missing);
          return;
        }
        showError(messages[res && res.error] || 'Sorry, that did not go through. Please try again, or email manuelynatashatamayo@gmail.com.');
      })
      .catch(function () {
        showError('We could not reach the server. Check your connection and try again, your answers are saved on this device.');
      })
      .then(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = label;
      });
  }

  /* Start up */

  if (new Date() > CUTOFF) { showClosed(); return; }

  loadDraft();
  syncAttending();
  syncSeats();
  syncExtra();
  syncHotel();

  Array.prototype.forEach.call(form.querySelectorAll('input[name="attending"]'), function (r) {
    r.addEventListener('change', syncAttending);
  });
  $('f-seats').addEventListener('change', syncSeats);
  extraBox.addEventListener('change', syncExtra);
  hotelBox.addEventListener('change', syncHotel);

  form.addEventListener('input', function () { saveDraft(); updateHotelMail(); });
  form.addEventListener('change', function () { saveDraft(); updateHotelMail(); });
  form.addEventListener('submit', submit);

  hotelMail.addEventListener('click', function (ev) {
    if (!val('f-name')) {
      ev.preventDefault();
      fieldError('f-name', 'Add your name first so the hotel knows who is booking.');
    }
  });
})();
