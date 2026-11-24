/**
 * Wedding RSVP backend for manuelynatasha.com, single link version (November 2026).
 *
 * One RSVP form for everyone, no codes. Each reply lands in the RSVPs tab,
 * one row per email address. Manny and Natasha set the Status column, then
 * use the Wedding RSVP menu, Send emails, to send the confirmation, waitlist
 * or declined email to everyone whose status has changed.
 *
 * This copy is for version control only. Paste it into the Apps Script editor
 * attached to the Wedding RSVP spreadsheet. backend/SETUP.md has the steps.
 * Nothing in this file holds a guest list, an email address or a key.
 */

// Settings

// Leave as it is. The script uses the spreadsheet it is attached to.
// Only paste a Sheet ID here if the script ever lives outside the sheet.
const SHEET_ID = 'PASTE_SHEET_ID_HERE';

// Replies close at 23:59 Manila time on this date.
const CUTOFF = '2027-01-15T23:59:00+08:00';
const CUTOFF_TEXT = '15 January 2027';
const CONFIRM_BY_TEXT = '31 January 2027';

const SITE_URL = 'https://manuelynatasha.com';
const FROM_NAME = 'Manny at Tash';

// While true, emails are written to the Log tab instead of being sent.
// Switch to false in the script editor once a test reply looks right.
const DRY_RUN = true;

// A free Gmail account may send to about 100 people a day from a script.
// Anything over this is left for the next run of Send emails.
const DAILY_EMAIL_LIMIT = 80;

// Shared limit on new replies per hour, a guard against junk submissions.
const MAX_SUBMITS_PER_HOUR = 60;

const MAX_SEATS = 2;

// A short heads up email goes to these addresses for every new or changed reply.
// It is sent even while DRY_RUN is on, because it only goes to you.
// To also get it at another address, add it inside the quotes, for example
// 'name@example.com'. Do it in the script editor only, not in the copy on GitHub.
const NOTIFY_TO = 'manuelynatashatamayo@gmail.com';
const NOTIFY_EXTRA = '';

const HOTEL = {
  reservations: 'reservations@diamondhotel.com',
  events: 'pmanalastas@diamondhotel.com',
  wedding: 'manuelynatashatamayo@gmail.com',
  reference: "Tamayo's Wedding, April 10, 2027"
};

const TAB = { rsvps: 'RSVPs', invite: 'InviteList', send: 'Send invites', log: 'Log' };

// The RSVPs tab. Order matters, the code reads columns by these names.
const COLS = [
  'received', 'updated', 'status', 'attending', 'name', 'email', 'phone',
  'seats', 'guest_names', 'country', 'dietary', 'extra_seats', 'extra_seats_details',
  'hotel', 'hotel_rooms', 'hotel_room_type', 'hotel_check_in', 'hotel_check_out',
  'their_message', 'list_check', 'my_notes', 'personal_line', 'emailed'
];
const C = {};
COLS.forEach(function (name, i) { C[name] = i; });

const STATUS = ['New', 'Confirmed', 'Waitlist', 'Declined', 'Not coming'];
const LOG_HEADERS = ['timestamp', 'event', 'detail'];

// Menu in the spreadsheet

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Wedding RSVP')
    .addItem('Send emails', 'sendStatusEmails')
    .addItem('Check against guest list', 'checkAgainstList')
    .addItem('Build invite messages', 'buildInviteMessages')
    .addSeparator()
    .addItem('Set up tabs (first time only)', 'setupTabs')
    .addToUi();
}

// Run once. Adds the RSVPs and Log tabs with headings, the Status dropdown
// and colours. Safe to run again, it never deletes anything.
function setupTabs() {
  const book = book_();
  let sheet = book.getSheetByName(TAB.rsvps);
  if (!sheet) sheet = book.insertSheet(TAB.rsvps, 0);
  sheet.getRange(1, 1, 1, COLS.length).setValues([COLS.map(heading_)])
    .setFontWeight('bold').setBackground('#F5EDDD');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(5);

  const statusRange = sheet.getRange(2, C.status + 1, sheet.getMaxRows() - 1, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS, true).setAllowInvalid(false).build());

  const rules = [
    ['Confirmed', '#D9EAD3'], ['Waitlist', '#FFF2CC'], ['Declined', '#E6E6E6'],
    ['Not coming', '#E6E6E6'], ['New', '#FCE5CD']
  ].map(function (pair) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(pair[0])
      .setBackground(pair[1]).setRanges([statusRange]).build();
  });
  sheet.setConditionalFormatRules(rules);

  [C.their_message, C.my_notes, C.personal_line, C.guest_names, C.list_check].forEach(function (i) {
    sheet.setColumnWidth(i + 1, 260);
  });
  sheet.getRange(1, C.my_notes + 1).setNote('Private. Never sent to the guest.');
  sheet.getRange(1, C.personal_line + 1).setNote('Optional. Added to this guest\'s next email, under the greeting.');
  sheet.getRange(1, C.emailed + 1).setNote('Filled in by Send emails. Clear it to send the same email again.');

  if (!book.getSheetByName(TAB.log)) {
    const log = book.insertSheet(TAB.log);
    log.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    log.setFrozenRows(1);
  }
  if (book.getSheetByName(TAB.invite)) buildInviteMessages();
  try { SpreadsheetApp.getActive().toast('RSVP tabs are ready.'); } catch (err) { /* run outside the sheet */ }
}

// Web app entry points

function doGet() {
  return json_({ ok: true, open: !deadlinePassed_() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: 'bad_request' });
  }
  if (body.action !== 'submit') return json_({ error: 'unknown_action' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return json_(submit_(body));
  } catch (err) {
    log_('error', String(err));
    return json_({ error: 'server_busy' });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Saving a reply

function submit_(b) {
  if (clean_(b.website)) return { ok: true }; // hidden field, only robots fill it
  if (deadlinePassed_()) return { error: 'closed' };
  if (submitsLastHour_() >= MAX_SUBMITS_PER_HOUR) return { error: 'server_busy' };

  const attending = b.attending === 'no' ? 'no' : 'yes';
  const r = {
    attending: attending,
    name: clean_(b.name, 120),
    email: clean_(b.email, 160).toLowerCase(),
    phone: clean_(b.phone, 40),
    message: clean_(b.message, 1500)
  };
  if (!r.name) return { error: 'missing', field: 'name' };
  if (!isEmail_(r.email)) return { error: 'missing', field: 'email' };
  if (!/\d{6,}/.test(r.phone.replace(/\D/g, ''))) return { error: 'missing', field: 'phone' };

  if (attending === 'yes') {
    r.seats = Math.max(1, Math.min(MAX_SEATS, parseInt(b.seats, 10) || 1));
    r.guests = (Array.isArray(b.guests) ? b.guests : []).map(function (g) { return clean_(g, 120); })
      .filter(String).slice(0, r.seats);
    if (r.guests.length < r.seats) return { error: 'missing', field: 'guests' };
    r.country = clean_(b.country, 60);
    r.dietary = clean_(b.dietary, 500);
    r.extra = b.extraSeats ? 'yes' : '';
    r.extraDetails = r.extra ? clean_(b.extraDetails, 500) : '';
    r.hotel = b.hotel ? 'yes' : '';
    r.rooms = r.hotel ? String(Math.max(1, Math.min(10, parseInt(b.rooms, 10) || 1))) : '';
    r.roomType = r.hotel ? clean_(b.roomType, 60) : '';
    r.checkIn = r.hotel ? clean_(b.checkIn, 20) : '';
    r.checkOut = r.hotel ? clean_(b.checkOut, 20) : '';
  }

  const saved = writeRow_(r);
  notifyCouple_(r, saved.updated);
  sendReceipt_(r);
  return { ok: true, updated: saved.updated };
}

function writeRow_(r) {
  const sheet = rsvpSheet_();
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][C.email]).toLowerCase() === r.email) { rowIndex = i; break; }
  }
  const row = rowIndex > 0 ? data[rowIndex].slice() : COLS.map(function () { return ''; });
  while (row.length < COLS.length) row.push('');
  const before = row[C.status];

  row[C.received] = row[C.received] || now;
  row[C.updated] = now;
  row[C.attending] = r.attending === 'yes' ? 'Yes' : 'No';
  row[C.name] = r.name;
  row[C.email] = r.email;
  row[C.phone] = "'" + r.phone; // keep the leading plus and zeros
  row[C.seats] = r.attending === 'yes' ? r.seats : 0;
  row[C.guest_names] = (r.guests || []).join(', ');
  row[C.country] = r.country || '';
  row[C.dietary] = r.dietary || '';
  row[C.extra_seats] = r.extra || '';
  row[C.extra_seats_details] = r.extraDetails || '';
  row[C.hotel] = r.hotel || '';
  row[C.hotel_rooms] = r.rooms || '';
  row[C.hotel_room_type] = r.roomType || '';
  row[C.hotel_check_in] = r.checkIn || '';
  row[C.hotel_check_out] = r.checkOut || '';
  row[C.their_message] = r.message;

  if (r.attending === 'no') {
    row[C.status] = 'Not coming';
  } else if (!before || before === 'Not coming') {
    row[C.status] = 'New';
  }
  const notes = [];
  if (rowIndex > 0) notes.push('Changed their reply on ' + fmtDate_(now));
  if (rowIndex > 0 && before && before !== 'New' && before !== 'Not coming' && r.attending === 'yes') {
    notes.push('was ' + before + ' before this change, check it');
  }
  row[C.list_check] = [listCheck_(r)].concat(notes).filter(String).join('. ');

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 1, 1, COLS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  log_('reply', r.attending + (rowIndex > 0 ? ', updated' : ', new'));
  return { updated: rowIndex > 0 };
}

// Emails

// Heads up for the couple, one short email per reply. Never blocks a reply.
function notifyCouple_(r, updated) {
  try {
    const to = [NOTIFY_TO, NOTIFY_EXTRA].filter(String).join(',');
    const head = (updated ? 'Updated RSVP: ' : 'New RSVP: ') + r.name + ', ' +
      (r.attending === 'yes' ? 'coming, ' + r.seats + (r.seats === 1 ? ' seat' : ' seats') : 'can\'t make it');
    const lines = [
      r.name + ' (' + r.email + ', ' + r.phone + ')',
      r.attending === 'yes' ? 'Guests: ' + r.guests.join(', ') : 'Not coming',
      r.attending === 'yes' && r.country ? 'From: ' + r.country : '',
      r.extra ? 'Asking for extra seats: ' + (r.extraDetails || 'yes') : '',
      r.hotel ? 'Interested in the Diamond Hotel rate' : '',
      r.dietary ? 'Dietary: ' + r.dietary : '',
      r.message ? 'Message: ' + r.message : '',
      '',
      'Open the RSVPs tab in the Wedding RSVP sheet to set their status.'
    ].filter(function (l, i) { return l !== '' || i === 7; });
    MailApp.sendEmail({ to: to, subject: head, body: lines.join('\n'), name: 'Wedding RSVP' });
  } catch (err) {
    log_('notify_failed', String(err));
  }
}

// Sent straight away, so every guest has a copy of what they sent.
function sendReceipt_(r) {
  let body;
  if (r.attending === 'no') {
    body = 'Hi ' + r.name + ',\n\n' +
      'Thank you for letting us know you can\'t make it. You\'ll be missed, and we\'ll be thinking of you on the day.\n\n' +
      updatesLine_() + '\n\n' +
      'With love,\nManny at Tash';
    send_(r.email, 'Thank you for letting us know', body, 'receipt_no');
    return;
  }
  body = 'Hi ' + r.name + ',\n\n' +
    'Salamat! We\'ve received your RSVP. This is a copy of what you sent us. ' +
    'It doesn\'t lock in your seats yet, we\'ll be in touch by ' + CONFIRM_BY_TEXT + ' to confirm.\n\n' +
    'Guests: ' + r.guests.join(', ') + '\n' +
    'Travelling from: ' + (r.country || 'not given') + '\n' +
    'Dietary requirements: ' + (r.dietary || 'none') + '\n' +
    (r.extra ? 'Extra seats requested: ' + (r.extraDetails || 'yes') + '\n' +
      'We can\'t guarantee extra seats, but we\'ll do our best.\n' : '') +
    (r.message ? 'Your message: ' + r.message + '\n' : '') +
    '\n' + (r.hotel ? hotelSteps_(r) + '\n\n' : '') +
    'If anything changes, send the form again with the same email address and we\'ll update your reply.\n\n' +
    updatesLine_() + '\n\n' +
    'With love,\nManny at Tash';
  send_(r.email, 'We\'ve received your RSVP', body, 'receipt_yes');
}

// Menu: Wedding RSVP, Send emails. Sends one email per row whose Status is
// Confirmed, Waitlist or Declined and whose emailed column does not already
// show that status. Rows marked New or Not coming are left alone.
function sendStatusEmails() {
  const sheet = rsvpSheet_();
  const data = sheet.getDataRange().getValues();
  let sent = 0, skipped = 0, left = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[C.status]);
    if (['Confirmed', 'Waitlist', 'Declined'].indexOf(status) < 0) continue;
    if (String(row[C.emailed]).indexOf(status) === 0) { skipped++; continue; }
    if (!DRY_RUN && emailsSentLast24h_() >= DAILY_EMAIL_LIMIT) { left++; continue; }
    const mail = statusEmail_(status, row);
    const ok = send_(String(row[C.email]), mail.subject, mail.body, 'status_' + status);
    if (ok) {
      sheet.getRange(i + 1, C.emailed + 1).setValue(status + ' email sent ' + fmtDate_(new Date()));
      sent++;
    }
  }
  const msg = (DRY_RUN ? 'Test mode, nothing was sent. ' + sent + ' emails written to the Log tab. ' :
    sent + ' emails sent. ') +
    (skipped ? skipped + ' already emailed. ' : '') +
    (left ? left + ' left for tomorrow because of the daily limit, run Send emails again then.' : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { Logger.log(msg); }
}

function statusEmail_(status, row) {
  const name = String(row[C.name]);
  const personal = String(row[C.personal_line] || '').trim();
  const opening = 'Hi ' + name + ',\n\n' + (personal ? personal + '\n\n' : '');
  if (status === 'Confirmed') {
    return {
      subject: 'You\'re confirmed, Manny at Tash, 10 April 2027',
      body: opening +
        'Salamat! Your seats are confirmed for our wedding.\n\n' +
        'Confirmed guests: ' + row[C.guest_names] + '\n\n' +
        'Ceremony: Saturday 10 April 2027, 4pm\n' +
        'San Agustin Church, Intramuros, Manila\n' +
        'Please arrive by 3:30pm\n\n' +
        'Reception: 6pm, doors open from 5:30pm\n' +
        'Constellation Room, 27th floor, Diamond Hotel Manila\n\n' +
        'After party: once the reception wraps up, join us at Bar 27, just across the hallway on the 27th floor.\n\n' +
        updatesLine_() + ' The dress code, travel tips and hotel booking details are all there too.\n\n' +
        'If anything changes, just reply to this email.\n\n' +
        'See you in Manila,\nManny at Tash'
    };
  }
  if (status === 'Waitlist') {
    return {
      subject: 'Your RSVP, Manny at Tash',
      body: opening +
        'Thank you for your RSVP. We\'re still working through seating, and we\'ll let you know as soon as we can confirm.\n\n' +
        updatesLine_() + '\n\n' +
        'With love,\nManny at Tash'
    };
  }
  return {
    subject: 'Your RSVP, Manny at Tash',
    body: opening +
      'Thank you so much for your RSVP. Our venue limits our numbers, and we\'re sorry we can\'t fit everyone we would love to have there. ' +
      'We hope to celebrate with you another time.\n\n' +
      'With love,\nManny at Tash'
  };
}

function hotelSteps_(r) {
  return 'Staying at the Diamond Hotel\n' +
    'You asked about the wedding rate at the Diamond Hotel (' + r.rooms + ' room' + (r.rooms === '1' ? '' : 's') +
    (r.roomType ? ', ' + r.roomType : '') +
    (r.checkIn ? ', ' + r.checkIn + ' to ' + r.checkOut : '') + '). Your RSVP does not book a room. To book:\n' +
    '1. Email ' + HOTEL.reservations + ' and copy in ' + HOTEL.events + ' and ' + HOTEL.wedding + '.\n' +
    '2. Quote "' + HOTEL.reference + '" and give your names, dates, number of rooms and room type.\n' +
    '3. The hotel replies with your special wedding rate and how to pay.\n' +
    '4. Pay the hotel directly. Your room is confirmed by the hotel, not by us.\n' +
    'Bookings are by email only, not online.';
}

function updatesLine_() {
  return 'All updates will be posted on our website, ' + SITE_URL.replace('https://', '') +
    ', and we\'ll email you too whenever there\'s news.';
}

function send_(to, subject, body, kind) {
  if (DRY_RUN) {
    log_('dry_run_' + kind, to + ' | ' + subject + ' | ' + body.slice(0, 4000));
    return true;
  }
  if (emailsSentLast24h_() >= DAILY_EMAIL_LIMIT) {
    log_('email_deferred', kind);
    return false;
  }
  try {
    MailApp.sendEmail({ to: to, subject: subject, body: body, name: FROM_NAME, replyTo: HOTEL.wedding });
  } catch (err) {
    log_('email_failed', kind + ': ' + err);
    return false;
  }
  log_('email_sent', kind);
  return true;
}

// Menu: Wedding RSVP, Check against guest list. Re-runs the guest list check
// on every row, useful after the InviteList tab has been tidied up.
function checkAgainstList() {
  const sheet = rsvpSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[C.attending]) !== 'Yes') continue;
    const check = listCheck_({
      attending: 'yes',
      name: String(row[C.name]),
      guests: String(row[C.guest_names]).split(',').map(function (s) { return s.trim(); }).filter(String),
      extra: row[C.extra_seats]
    });
    const kept = String(row[C.list_check]).split('. ').filter(function (s) { return /^Changed|^was /.test(s); });
    sheet.getRange(i + 1, C.list_check + 1).setValue([check].concat(kept).filter(String).join('. '));
  }
  try { SpreadsheetApp.getUi().alert('Guest list check updated.'); } catch (err) { /* run from editor */ }
}

// Menu: Wedding RSVP, Build invite messages. Makes the Send invites tab, one
// row per household on the InviteList tab, each with a ready message to copy
// into Messenger, SMS, WhatsApp or Viber, and a tick box for when it is sent.
// Running it again adds new households and keeps every tick and edit.
function buildInviteMessages() {
  const book = book_();
  const invite = book.getSheetByName(TAB.invite);
  if (!invite) throw new Error('No InviteList tab found.');
  let sheet = book.getSheetByName(TAB.send);
  if (!sheet) {
    sheet = book.insertSheet(TAB.send, 1);
    sheet.getRange(1, 1, 1, 5).setValues([['Household', 'Language', 'Message to copy', 'Sent', 'Notes']])
      .setFontWeight('bold').setBackground('#F5EDDD');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(3, 520);
    sheet.setColumnWidth(5, 220);
    sheet.appendRow(['Anyone else (general)', 'en', inviteMessage_('', 'en'), false, 'Use when someone is not on the list']);
    sheet.appendRow(['Anyone else (general)', 'tl', inviteMessage_('', 'tl'), false, 'Tagalog version']);
  }
  const existing = sheet.getDataRange().getValues().slice(1).map(function (r) { return String(r[0]); });
  const seen = {};
  const rows = [];
  invite.getDataRange().getValues().slice(1).forEach(function (r) {
    const household = String(r[1] || '').trim();
    if (!household || seen[household] || /names to come/i.test(household)) return;
    seen[household] = true;
    if (existing.indexOf(household) >= 0) return;
    const lang = String(r[8] || '').trim() === 'tl' ? 'tl' : 'en';
    rows.push([household, lang, inviteMessage_(household, lang), false, '']);
  });
  if (rows.length) {
    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, 5).setValues(rows);
  }
  const last = sheet.getLastRow();
  if (last > 1) {
    sheet.getRange(2, 4, last - 1, 1).insertCheckboxes();
    sheet.getRange(2, 3, last - 1, 1).setWrap(true).setVerticalAlignment('top');
  }
  try { SpreadsheetApp.getUi().alert(rows.length + ' households added to Send invites.'); } catch (err) { /* run from editor */ }
}

function inviteMessage_(household, lang) {
  const link = SITE_URL.replace('https://', '') + '/rsvp/';
  if (lang === 'tl') {
    return 'Hi' + (household ? ' ' + household : '') + '! Ikakasal na po kami ni Natasha sa Sabado, ikasampu ng Abril 2027, ' +
      'sa San Agustin Church, Intramuros, Maynila. Sana po ay makasama namin kayo.\n\n' +
      'RSVP po bago ang ' + CUTOFF_TEXT.replace('January', 'Enero') + ': ' + link + '\n\n' +
      'Nandoon na rin po ang lahat ng detalye ng kasal, biyahe at hotel. Salamat po!\nManuel at Natasha';
  }
  return 'Hi' + (household ? ' ' + household : '') + '! We\'re getting married on Saturday 10 April 2027 at San Agustin Church, ' +
    'Intramuros, Manila, and we\'d love you to be there.\n\n' +
    'Please RSVP by ' + CUTOFF_TEXT + ' here: ' + link + '\n' +
    'The sooner you reply, the sooner we can confirm your seats.\n\n' +
    'Everything about the day, travel and hotels is on the website too.\nManuel and Natasha';
}

// Compares first names against the InviteList tab. The list is rough, mostly
// first names, so this is a prompt to look, never a decision.
function listCheck_(r) {
  if (r.attending !== 'yes') return '';
  const flags = [];
  if (r.extra) flags.push('Asking for extra seats');
  const known = inviteNames_();
  if (known.length) {
    const missing = [r.name].concat(r.guests || []).filter(function (n) {
      const first = firstName_(n);
      return first && known.indexOf(first) < 0;
    });
    if (missing.length) flags.push('Not found on guest list: ' + unique_(missing).join(', '));
  }
  return flags.join('. ');
}

function inviteNames_() {
  const sheet = book_().getSheetByName(TAB.invite);
  if (!sheet) return [];
  const out = [];
  sheet.getDataRange().getValues().slice(1).forEach(function (row) {
    [row[1], row[2]].forEach(function (cell) {
      String(cell || '').split(/\s+and\s+|,|&/i).forEach(function (part) {
        const first = firstName_(part);
        if (first) out.push(first);
      });
    });
  });
  return out;
}

function firstName_(n) {
  const words = String(n || '').toLowerCase().replace(/[()]/g, ' ')
    .replace(/\b(tita|tito|mr|mrs|ms|dr|general|gen|maj|cong)\b\.?/g, ' ').trim().split(/\s+/);
  return words[0] || '';
}

// Helpers

function book_() {
  if (SHEET_ID && SHEET_ID !== 'PASTE_SHEET_ID_HERE') return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function rsvpSheet_() {
  const sheet = book_().getSheetByName(TAB.rsvps);
  if (!sheet) throw new Error('No RSVPs tab yet. Run Wedding RSVP, Set up tabs first.');
  return sheet;
}

function log_(event, detail) {
  const book = book_();
  let sheet = book.getSheetByName(TAB.log);
  if (!sheet) {
    sheet = book.insertSheet(TAB.log);
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  }
  sheet.appendRow([new Date(), event, detail || '']);
}

function logCount_(event, sinceMs) {
  const sheet = book_().getSheetByName(TAB.log);
  if (!sheet) return 0;
  const since = Date.now() - sinceMs;
  return sheet.getDataRange().getValues().slice(1).filter(function (r) {
    return r[1] === event && new Date(r[0]).getTime() >= since;
  }).length;
}

function emailsSentLast24h_() { return logCount_('email_sent', 24 * 60 * 60 * 1000); }
function submitsLastHour_() { return logCount_('reply', 60 * 60 * 1000); }

function deadlinePassed_() { return Date.now() > new Date(CUTOFF).getTime(); }

function isEmail_(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

function clean_(value, max) { return String(value || '').trim().slice(0, max || 500); }

function heading_(col) {
  return col.replace(/_/g, ' ').replace(/^\w/, function (c) { return c.toUpperCase(); });
}

function fmtDate_(d) {
  return Utilities.formatDate(d, 'Asia/Manila', 'd MMM yyyy');
}

function unique_(list) {
  return list.filter(function (v, i) { return list.indexOf(v) === i; });
}
