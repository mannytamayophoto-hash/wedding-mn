# RSVP setup, about 10 minutes

You do this once, signed in as the wedding Gmail (manuelynatashatamayo@gmail.com). Never share the password with anyone, including Claude.

The script lives inside the Google Sheet, so there is no Sheet ID to paste anywhere.

## 1. Open the sheet

1. Go to drive.google.com and sign in to the wedding Gmail.
2. Open the spreadsheet called Copy of Wedding RSVP.

## 2. Paste the script

1. In the sheet, click Extensions, then Apps Script. A new tab opens.
2. On the left, click Code.gs. Select everything in the editor and delete it.
3. Open backend/Code.gs on GitHub (repo wedding-mn), click Raw, select all, copy.
4. Paste it into the Apps Script editor.
5. Click the disk icon (Save). Name the project Wedding RSVP if it asks.

## 3. Set up the tabs

1. At the top, pick setupTabs from the function dropdown, then click Run.
2. Google asks for permission. Click Review permissions, choose the wedding Gmail, then Advanced, then Go to Wedding RSVP (unsafe), then Allow. This is normal for your own script.
3. Go back to the sheet. You should now see the RSVPs and Send invites tabs, and a Wedding RSVP menu at the top.

## 4. Publish it as a web app

1. In Apps Script click Deploy, then New deployment.
2. Click the gear next to Select type and choose Web app.
3. Set Execute as to Me.
4. Set Who has access to Anyone.
5. Click Deploy. Allow permissions again if asked.
6. Copy the Web app URL. It ends in /exec.
7. Send that URL to Claude. It goes into site/js/rsvp.js. It is safe to put on the website.

## 5. Test it

1. Claude will send a test reply with your own email.
2. Check the RSVPs tab for a new row, and the Log tab for the confirmation email. DRY_RUN is on, so nothing is actually emailed yet.
3. Once the log looks right, in Code.gs change DRY_RUN to false, then update the deployment as in step 6.

## 6. Changing the script later

Always update the existing deployment, never make a new one, or the URL changes and the website stops working.

1. Click Deploy, then Manage deployments.
2. Click the pencil.
3. Under Version choose New version.
4. Click Deploy.

## Using the sheet day to day

- RSVPs tab: one row per email address. Set the Status column (Confirmed, Waitlist, Declined). My notes and Personal line are private to you, the personal line is added to that guest's next email.
- Wedding RSVP menu, Send emails: sends the Confirmed, Waitlist or Declined email to every row whose status changed since the last send.
- Wedding RSVP menu, Check against guest list: flags names not found in InviteList and extra seat requests.
- Wedding RSVP menu, Build invite messages: fills the Send invites tab. Each row is a ready message with the RSVP link, in English or Tagalog, to copy and paste into Messenger, WhatsApp, Viber, SMS or email. Tick Sent when done.
- Gmail sends about 80 emails a day from this script, so spread large batches over a few days.

## Settings in Code.gs

- DRY_RUN: true logs emails instead of sending. Switch to false only after checking the Log tab.
- CUTOFF: RSVPs close 15 January 2027, 23:59 Manila time. The server enforces it.
- CONFIRM_BY_TEXT: the date we promise to confirm by, 31 January 2027.
- MAX_SEATS: 2 per reply.
