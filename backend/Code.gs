/**
 * Wedding RSVP backend for manuelynatasha.com.
 *
 * This copy is for version control only. Paste it into the Apps Script editor
 * attached to the "Wedding RSVP" spreadsheet. backend/SETUP.md has the steps.
 *
 * Nothing in this file holds a guest list, an email address or a key. The
 * Sheet ID is typed into the script editor by hand and is never committed.
 */

// Settings

// Paste the Sheet ID from the spreadsheet URL here, in the script editor only.
const SHEET_ID = 'PASTE_SHEET_ID_HERE';

// Replies close at 23:59 Manila time on this date.
const CUTOFF = '2027-01-15T23:59:00+08:00';

const SITE_URL = 'https://manuelynatasha.com';
const FROM_NAME = 'Manuel y Natasha';

// While true, anything that sends email only writes to the execution log.
// Set it to false in the script editor only after the dry run looks right.
const DRY_RUN = true;

// A free Gmail account may send to 100 recipients a day through Apps Script.
// Stay under it. Anything over the limit is skipped and logged, and the next
// run carries on from where this one stopped.
const DAILY_EMAIL_LIMIT = 80;

// Lockout. Apps Script cannot see the visitor address, so this limit is shared
// by everyone: more than MAX_FAILS failed attempts in the window blocks new ones.
const MAX_FAILS = 30;
const FAIL_WINDOW_MINUTES = 15;

// No I or O, and no 0 or 1, so codes cannot be misread when typed or printed.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const TAB = {
  invite: 'InviteList',
  responses: 'Responses',
  log: 'Log',
  sendList: 'SendList',
  manual: 'ManualReminders',
  qr: 'QR'
};

// Column positions, counted from zero, matching the layout in RSVP_PLAN.md.
const INVITE = { code: 0, household: 1, guest: 2, maxParty: 3, email: 4, phone: 5, channel: 6, segment: 7, language: 8, notes: 9 };
const RESP = { code: 0, attending: 1, guests: 2, headcount: 3, dietary: 4, song: 5, hotel: 6, flight: 7, email: 8, message: 9, source: 10, created: 11, updated: 12 };

const HEADERS = {
  Log: ['timestamp', 'code', 'outcome'],
  SendList: ['code', 'household', 'channel', 'email', 'phone', 'link', 'message', 'sent'],
  ManualReminders: ['code', 'household', 'channel', 'phone', 'link', 'message'],
  QR: ['code', 'household', 'url']
};

// Run once from the script editor after pasting the Sheet ID. Names the first tab
// InviteList and adds the Responses and Log tabs with their headers. Safe to run
// again, it never changes a tab that already exists.
const RESPONSE_HEADERS = ['code', 'attending', 'guests_json', 'headcount', 'dietary', 'song',
  'hotel_interest', 'flight_interest', 'email', 'message', 'source', 'created_at', 'updated_at'];

function setupTabs() {
  const book = SpreadsheetApp.openById(SHEET_ID);
  if (!book.getSheetByName(TAB.invite)) book.getSheets()[0].setName(TAB.invite);
  [[TAB.responses, RESPONSE_HEADERS], [TAB.log, HEADERS.Log]].forEach(function (pair) {
    if (book.getSheetByName(pair[0])) return;
    const sheet = book.insertSheet(pair[0]);
    sheet.getRange(1, 1, 1, pair[1].length).setValues([pair[1]]);
    sheet.setFrozenRows(1);
  });
  Logger.log('Tabs ready: ' + book.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

// Web app entry points

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === 'lookup') return json_(lookup_(params.code));
  return json_({ error: 'unknown_action' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: 'bad_request' });
  }
  if (body.action === 'submit') return json_(submit_(body));
  return json_({ error: 'unknown_action' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lookup

function lookup_(rawCode) {
  const code = normaliseCode_(rawCode);
  if (!code) return { error: 'not_found' };
  if (tooManyFails_()) return { error: 'locked' };

  const hh = readHouseholds_()[code];
  if (!hh) {
    logAttempt_(code, 'fail');
    return { error: 'not_found' };
  }

  const saved = findSaved_(code);
  const guests = hh.named.map(function (name) {
    return { name: name, attending: answerFor_(saved, name) };
  });
  const extras = saved ? saved.guests.filter(function (g) {
    return !isNamed_(hh, g.name);
  }) : [];

  return {
    household: hh.household,
    guests: guests.concat(extras),
    open_slots: hh.openSlots,
    max_party: hh.maxParty,
    email: (saved && saved.email) || hh.email,
    deadline_passed: deadlinePassed_(),
    existing: saved ? {
      attending: saved.attending,
      dietary: saved.dietary,
      song: saved.song,
      message: saved.message,
      hotel_interest: saved.hotel,
      flight_interest: saved.flight,
      email: saved.email
    } : null
  };
}

// Submit

function submit_(body) {
  const code = normaliseCode_(body.code);
  if (tooManyFails_()) return { error: 'locked' };
  if (deadlinePassed_()) return { error: 'deadline_passed' };

  const hh = readHouseholds_()[code];
  if (!hh) {
    logAttempt_(code, 'fail');
    return { error: 'not_found' };
  }

  const email = String(body.email || '').trim();
  if (!isEmail_(email)) return { error: 'email_invalid' };

  const check = checkGuests_(hh, body.guests);
  if (check.error) return { error: check.error };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { error: 'busy' };

  let saved;
  try {
    saved = writeResponse_(hh, code, email, check.guests, body);
  } finally {
    lock.releaseLock();
  }

  sendConfirmation_(hh, saved);
  return { ok: true };
}

// Checks the submitted guests against the household. Every named guest needs a
// yes or no. Anything left over must fit in the open plus one slots.
function checkGuests_(hh, guests) {
  if (!Array.isArray(guests)) return { error: 'bad_request' };

  const pool = guests.map(function (g) {
    return { name: String(g.name || '').trim(), attending: g.attending };
  });
  if (pool.some(function (g) { return g.attending !== 'yes' && g.attending !== 'no'; })) {
    return { error: 'bad_request' };
  }

  const answered = [];
  for (let i = 0; i < hh.named.length; i++) {
    const idx = indexOfName_(pool, hh.named[i]);
    if (idx === -1) return { error: 'missing_guest' };
    answered.push({ name: hh.named[i], attending: pool[idx].attending });
    pool.splice(idx, 1);
  }

  if (pool.length > hh.openSlots) return { error: 'too_many_guests' };
  if (pool.some(function (g) { return !g.name; })) return { error: 'bad_request' };

  const extras = pool.map(function (g) { return { name: g.name, attending: g.attending }; });
  const yes = answered.concat(extras).filter(function (g) { return g.attending === 'yes'; }).length;
  if (yes > hh.maxParty) return { error: 'over_party_size' };

  return { guests: answered.concat(extras) };
}

function writeResponse_(hh, code, email, guests, body) {
  const now = new Date();
  const yes = guests.filter(function (g) { return g.attending === 'yes'; }).length;
  const attending = yes === 0 ? 'no' : (yes === guests.length ? 'yes' : 'partial');

  const values = {
    attending: attending,
    guests: JSON.stringify(guests),
    headcount: yes,
    dietary: clean_(body.dietary),
    song: clean_(body.song),
    hotel: flag_(body.hotel_interest),
    flight: flag_(body.flight_interest),
    email: email,
    message: clean_(body.message),
    source: 'web'
  };

  const sheet = sheet_(TAB.responses);
  const rows = sheet.getDataRange().getValues();
  let rowNumber = -1;
  for (let i = 1; i < rows.length; i++) {
    if (normaliseCode_(rows[i][RESP.code]) === code) {
      rowNumber = i + 1;
      break;
    }
  }

  const record = [code, values.attending, values.guests, values.headcount, values.dietary,
    values.song, values.hotel, values.flight, values.email, values.message, values.source,
    now, now];
  if (rowNumber === -1) {
    sheet.appendRow(record);
  } else {
    record[RESP.created] = rows[rowNumber - 1][RESP.created] || now;
    sheet.getRange(rowNumber, 1, 1, record.length).setValues([record]);
  }

  // Keep the household email on InviteList too, so later mail merges reach them.
  if (!hh.email) {
    const invite = sheet_(TAB.invite);
    const invRows = invite.getDataRange().getValues();
    for (let i = 1; i < invRows.length; i++) {
      if (normaliseCode_(invRows[i][INVITE.code]) === code) {
        invite.getRange(i + 1, INVITE.email + 1).setValue(email);
      }
    }
  }

  return {
    attending: attending,
    guests: guests,
    dietary: values.dietary,
    song: values.song,
    message: values.message,
    email: email
  };
}

// Email

function sendConfirmation_(hh, saved) {
  const lines = [
    'Buong galak po namin kayong inaanyayahan sa aming kasal, sa ikasampu ng Abril, dalawang libo dalawampu\'t pito, ikaapat ng hapon, sa Simbahan ng San Agustin, Intramuros, Maynila.',
    '',
    'With great joy we invite you to our wedding on 10 April 2027 at four in the afternoon, at San Agustin Church, Intramuros, Manila.',
    '',
    'Your reply for ' + hh.household + ':'
  ];
  saved.guests.forEach(function (g) {
    lines.push('  ' + g.name + ': ' + (g.attending === 'yes' ? 'attending' : 'not attending'));
  });
  if (saved.dietary) lines.push('Dietary: ' + saved.dietary);
  if (saved.song) lines.push('Song request: ' + saved.song);
  if (saved.message) lines.push('Message: ' + saved.message);
  lines.push(
    '',
    'You can change your reply at any time until 15 January 2027 at this link:',
    inviteLink_(hh.code),
    '',
    'With love, Manuel and Natasha'
  );
  send_(saved.email, 'Salamat, your RSVP for 10 April 2027', lines.join('\n'), 'confirmation');
}

function sendReminders() {
  const households = readHouseholds_();
  const responded = codesWithResponse_();
  const alreadySent = loggedCodes_('reminder_sent');
  const manual = [];

  Object.keys(households).forEach(function (code) {
    if (responded[code] || alreadySent[code]) return;
    const hh = households[code];
    if (!hh.email) {
      manual.push([code, hh.household, hh.channel, hh.phone, inviteLink_(code), reminderMessage_(hh)]);
      return;
    }
    if (send_(hh.email, 'Reminder: your RSVP for 10 April 2027', reminderBody_(hh), 'reminder')) {
      logAttempt_(code, 'reminder_sent');
    }
  });

  writeRows_(TAB.manual, manual);
}

// Sends the mail, or logs it while DRY_RUN is on. Returns true only when a real
// message went out, so a dry run, a skipped send or a failed send never marks a
// household as reminded. A mail error never stops a guest's reply being saved.
function send_(to, subject, body, kind) {
  if (DRY_RUN) {
    Logger.log('DRY RUN ' + kind + ' to ' + to + ': ' + subject);
    return false;
  }
  if (emailsSentLast24h_() >= DAILY_EMAIL_LIMIT) {
    logAttempt_('', 'email_deferred');
    Logger.log('Daily limit reached, not sent: ' + kind + ' to ' + to);
    return false;
  }
  try {
    GmailApp.sendEmail(to, subject, body, { name: FROM_NAME });
  } catch (err) {
    logAttempt_('', 'email_failed');
    Logger.log('Email failed: ' + kind + ' to ' + to + ': ' + err);
    return false;
  }
  logAttempt_('', 'email_sent');
  return true;
}

function emailsSentLast24h_() {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return outputSheet_(TAB.log).getDataRange().getValues().slice(1).filter(function (r) {
    return r[2] === 'email_sent' && new Date(r[0]).getTime() >= since;
  }).length;
}

function reminderBody_(hh) {
  return 'Dear ' + hh.household + ',\n\n' +
    'We would love to know whether you can join us in Manila on 10 April 2027. ' +
    'Please reply by 15 January 2027 at this link:\n' + inviteLink_(hh.code) + '\n\n' +
    'With love, Manuel and Natasha';
}

// Send list and utilities

// Builds the SendList tab. Keeps any sent ticks already made by hand.
function exportSendList() {
  const households = readHouseholds_();
  const sheet = outputSheet_(TAB.sendList);
  const sentBefore = {};
  sheet.getDataRange().getValues().slice(1).forEach(function (r) {
    sentBefore[normaliseCode_(r[0])] = r[7];
  });

  const rows = Object.keys(households).map(function (code) {
    const hh = households[code];
    return [code, hh.household, hh.channel, hh.email, hh.phone, inviteLink_(code),
      inviteMessage_(hh), sentBefore[code] || ''];
  });
  writeRows_(TAB.sendList, rows);
}

// Fills blank codes only, so running it again never changes an issued code.
// Consecutive rows for the same household share one code.
function generateCodes() {
  const sheet = sheet_(TAB.invite);
  const rows = sheet.getDataRange().getValues();
  const used = {};
  rows.slice(1).forEach(function (r) {
    const c = normaliseCode_(r[INVITE.code]);
    if (c) used[c] = true;
  });

  let previousHousehold = '';
  let previousCode = '';
  let filled = 0;
  for (let i = 1; i < rows.length; i++) {
    const household = String(rows[i][INVITE.household]).trim();
    if (!household) {
      previousHousehold = '';
      previousCode = '';
      continue;
    }
    let code = normaliseCode_(rows[i][INVITE.code]);
    if (!code) {
      code = household === previousHousehold && previousCode ? previousCode : newCode_(used);
      sheet.getRange(i + 1, INVITE.code + 1).setValue(code);
      filled++;
    }
    previousHousehold = household;
    previousCode = code;
  }
  return filled + ' codes filled';
}

// Builds the QR tab that feeds the printed invitations.
function exportQrList() {
  const households = readHouseholds_();
  const rows = Object.keys(households).map(function (code) {
    return [code, households[code].household, inviteLink_(code)];
  });
  writeRows_(TAB.qr, rows);
}

// Helpers

// Reads InviteList into one object per household code.
function readHouseholds_() {
  const rows = sheet_(TAB.invite).getDataRange().getValues().slice(1);
  const byCode = {};
  rows.forEach(function (row) {
    const code = normaliseCode_(row[INVITE.code]);
    if (!code) return;
    if (!byCode[code]) {
      byCode[code] = {
        code: code,
        household: String(row[INVITE.household]).trim(),
        maxParty: 0,
        email: '',
        phone: '',
        channel: '',
        segment: '',
        language: 'en',
        named: [],
        openSlots: 0
      };
    }
    const hh = byCode[code];
    const name = String(row[INVITE.guest]).trim();
    if (name) hh.named.push(name);
    if (!hh.maxParty) hh.maxParty = Number(row[INVITE.maxParty]) || 0;
    if (!hh.email) hh.email = String(row[INVITE.email]).trim();
    if (!hh.phone) hh.phone = String(row[INVITE.phone]).trim();
    if (!hh.channel) hh.channel = String(row[INVITE.channel]).trim();
    if (!hh.segment) hh.segment = String(row[INVITE.segment]).trim();
    if (row[INVITE.language]) hh.language = String(row[INVITE.language]).trim().toLowerCase();
  });
  Object.keys(byCode).forEach(function (code) {
    const hh = byCode[code];
    hh.openSlots = Math.max(0, hh.maxParty - hh.named.length);
  });
  return byCode;
}

function findSaved_(code) {
  const rows = sheet_(TAB.responses).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (normaliseCode_(rows[i][RESP.code]) === code) {
      return {
        attending: rows[i][RESP.attending],
        guests: parseGuests_(rows[i][RESP.guests]),
        dietary: rows[i][RESP.dietary],
        song: rows[i][RESP.song],
        hotel: rows[i][RESP.hotel],
        flight: rows[i][RESP.flight],
        email: rows[i][RESP.email],
        message: rows[i][RESP.message]
      };
    }
  }
  return null;
}

// Hand typed rows may hold no guest list, so a bad value reads as empty.
function parseGuests_(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function answerFor_(saved, name) {
  if (!saved) return '';
  const idx = indexOfName_(saved.guests, name);
  return idx === -1 ? '' : saved.guests[idx].attending;
}

function indexOfName_(list, name) {
  const wanted = name.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    if (String(list[i].name || '').trim().toLowerCase() === wanted) return i;
  }
  return -1;
}

function isNamed_(hh, name) {
  const wanted = String(name || '').trim().toLowerCase();
  return hh.named.some(function (n) { return n.toLowerCase() === wanted; });
}

function codesWithResponse_() {
  const codes = {};
  sheet_(TAB.responses).getDataRange().getValues().slice(1).forEach(function (r) {
    const c = normaliseCode_(r[RESP.code]);
    if (c) codes[c] = true;
  });
  return codes;
}

function loggedCodes_(outcome) {
  const codes = {};
  outputSheet_(TAB.log).getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[2] === outcome) codes[normaliseCode_(r[1])] = true;
  });
  return codes;
}

function tooManyFails_() {
  const since = Date.now() - FAIL_WINDOW_MINUTES * 60 * 1000;
  const fails = outputSheet_(TAB.log).getDataRange().getValues().slice(1).filter(function (r) {
    return r[2] === 'fail' && new Date(r[0]).getTime() >= since;
  });
  return fails.length > MAX_FAILS;
}

function logAttempt_(code, outcome) {
  outputSheet_(TAB.log).appendRow([new Date(), code, outcome]);
}

// Replaces the body of an output tab, keeping its header row.
function writeRows_(name, rows) {
  const sheet = outputSheet_(name);
  const header = HEADERS[name];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
}

// Tabs the people never type into. Created with headers if missing.
function outputSheet_(name) {
  const book = SpreadsheetApp.openById(SHEET_ID);
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
  }
  return sheet;
}

// Tabs the people fill in by hand. Must exist before the script runs.
function sheet_(name) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('Missing tab: ' + name);
  return sheet;
}

function newCode_(used) {
  let code;
  do {
    // Each byte of a random UUID is reduced modulo 32, which divides 256 evenly,
    // so every letter and digit in the alphabet is equally likely.
    const hex = Utilities.getUuid().replace(/-/g, '');
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      const byte = parseInt(hex.substr(i * 2, 2), 16);
      code += CODE_ALPHABET.charAt(byte % CODE_ALPHABET.length);
    }
  } while (used[code]);
  used[code] = true;
  return code;
}

function inviteLink_(code) {
  return SITE_URL + '/rsvp/?code=' + code;
}

function inviteMessage_(hh) {
  const link = inviteLink_(hh.code);
  if (hh.language === 'tl') {
    return "Buong galak po namin kayong inaanyayahan sa aming kasal, sa ikasampu ng Abril, dalawang libo dalawampu't pito. " +
      'Sagutin po ninyo ito dito: ' + link + ' (We warmly invite you to our wedding on 10 April 2027.) Manuel at Natasha';
  }
  return 'We warmly invite you to our wedding on 10 April 2027 in Manila. Reply here: ' + link + ' Manuel and Natasha';
}

function reminderMessage_(hh) {
  const link = inviteLink_(hh.code);
  if (hh.language === 'tl') {
    return 'Magandang araw po, ' + hh.household + '. Sana po ay makadalo kayo sa aming kasal. ' +
      'Pakisagot po dito bago ang ikalabinglima ng Enero: ' + link + ' Manuel at Natasha';
  }
  return 'Hello ' + hh.household + ', please reply by 15 January 2027 so we can plan the day: ' + link + ' Manuel and Natasha';
}

function deadlinePassed_() {
  return Date.now() > new Date(CUTOFF).getTime();
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normaliseCode_(raw) {
  return String(raw || '').toUpperCase().replace(/[\s-]/g, '');
}

function clean_(value) {
  return String(value || '').trim().slice(0, 500);
}

function flag_(value) {
  return value === 'yes' || value === 'no' ? value : '';
}
