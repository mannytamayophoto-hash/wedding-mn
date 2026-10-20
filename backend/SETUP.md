# RSVP backend setup

These steps are for Manny, done once in the wedding Google account. Nothing here needs the repo or any code editing except copying one file. Work through them in order.

Keep these private: the spreadsheet link, the Sheet ID, the web app URL until step 7, and any guest details. Never paste them into GitHub, into a chat with anyone outside the wedding team, or into a public document.

## Before you start

You need:

1. The wedding Google account, signed in in your browser. Use a normal browser window, not a private one.
2. The spreadsheet called Wedding RSVP. It already holds the guest list in the right columns, shared to the wedding account from Manny's own Drive.
3. The file `backend/Code.gs` from the GitHub repo. Open it on GitHub, click the Raw button, then select all and copy the text.

## Step 1. Get your own copy of the spreadsheet

1. In the wedding account, go to drive.google.com and click Shared with me.
2. Open the file called Wedding RSVP.
3. Click File, then Make a copy. Keep the name Wedding RSVP and click Make a copy.
4. The copy opens in a new tab. This copy belongs to the wedding account, and it is the one the script will use. Close the original tab so you do not edit it by mistake.

## Step 2. Check the invite list

1. Look at the first tab. Each row is one person or one open seat, grouped by household, with the code column empty. That is correct for now.
2. Fill in email, phone and channel when you know them. Use these values for channel: email, sms, messenger, whatsapp, viber or inperson. You can do this later too.
3. The language column is en for English or tl for Tagalog.
4. Leave the code column blank for now. The script fills it in at step 5.
5. Keep each household's rows together. A blank guest_name on a row is an open seat. max_party is the most people that household may bring, repeated on every row for that household.

This sheet holds real names and contact details. Keep the spreadsheet link private.

## Step 3. Open the script editor

1. In the spreadsheet, click Extensions in the top menu, then Apps Script.
2. A new tab opens with a file called Code.gs containing a placeholder function. Click inside it, press Command and A to select everything, then Delete.
3. Paste the text you copied from GitHub in the Before you start section.
4. Find the line that starts with `const SHEET_ID` near the top. Replace the text PASTE_SHEET_ID_HERE with the Sheet ID. The Sheet ID is the long string in the spreadsheet address between `/d/` and `/edit`. Keep the quote marks around it.
5. Press Command and S to save.
6. Click the project name at the top left, rename it to Wedding RSVP, then press Enter.

## Step 4. Set the time zone

1. In the left menu, click the gear icon labelled Project Settings.
2. Under Time zone, choose Asia/Manila (GMT+08:00).
3. This matters because the 15 January 2027 cutoff and the 1 January 2027 reminder are both Manila times.

## Step 5. Set up the tabs and create the household codes

1. Click the Editor icon in the left menu to go back to the code.
2. In the toolbar, use the function dropdown and choose setupTabs.
3. Press Run.
4. A window asks you to authorise the script. Choose Review permissions, pick the wedding account, then click Advanced and Go to Wedding RSVP. Click Allow. Google shows this warning because the script is new and private, not because anything is wrong.
5. Go back to the spreadsheet. The first tab is now called InviteList, and there are new tabs called Responses and Log.
6. Back in the script editor, choose generateCodes in the function dropdown and press Run.
7. Go back to the spreadsheet. Every household now has a six letter code in column A of InviteList, with the same code on each row for that household.

You can run generateCodes again later when you add households. It only fills in blank codes, so codes already given out never change. Keep each household's rows together so they share a code.

## Step 6. Publish the web app

1. In the script editor, click Deploy at the top right, then New deployment.
2. Click the gear icon beside Select type and choose Web app.
3. Set Description to RSVP v1.
4. Set Execute as to Me.
5. Set Who has access to Anyone.
6. Click Deploy. If asked, authorise again the same way as step 5.
7. Copy the Web app URL. It ends in `/exec`. Keep it in a private note for now. It goes into the website in a later step.

To change the code later, do not choose New deployment, because that gives a new URL. Instead, click Deploy, then Manage deployments, click the pencil icon, choose New version under Version, and click Deploy. The URL stays the same.

## Step 7. Test the lookup

1. Pick a real code from column A of InviteList.
2. Open a browser window and paste this, replacing the two parts in capitals. Keep the question mark and the ampersand:

   WEB_APP_URL?action=lookup&code=HOUSEHOLD_CODE

3. You should see text starting with `{"household":`. It lists only that household, with its named guests and the number of open seats. If you see `not_found`, check the code has no typos and that step 2 is done.

Do not share the test link. It shows the household's details.

## Step 8. Dry run the emails

The script has a switch called DRY_RUN, set to true when you first paste it. While it is true, nothing is emailed. The script only writes what it would have sent to the execution log.

1. In the script editor, choose sendReminders from the function dropdown and press Run.
2. Click Execution log at the bottom of the screen. You should see lines starting with DRY RUN, one per household that has an email and has not replied.
3. Check the ManualReminders tab in the spreadsheet. It lists households without an email address, with the link ready to copy into a text message or Messenger.

Only after the log looks right, change DRY_RUN in the script editor from true to false, then click Save. Keep it true until then.

### The daily email limit

A free Gmail account may send to only 100 recipients a day through Apps Script. Confirmations to guests count towards that too. The script stops at 80 emails in any 24 hours and writes email_deferred in the Log tab for each one it skips. A reminder that was skipped is not marked as sent, so run sendReminders again the next day and it carries on from where it stopped. If you ever see email_failed in the Log tab, the reply was still saved, only the email did not go.

## Step 9. Set the 1 January reminder

1. In the script editor, click the clock icon labelled Triggers in the left menu.
2. Click Add Trigger.
3. Set the function to sendReminders.
4. Set the event source to the timer option, the one that runs on a set date and time.
5. Choose Specific date and time, enter 1 January 2027 at 9:00am, and click Save.

The reminder runs once. It emails only households that have an email and have not replied, and writes the rest to ManualReminders. It can run twice safely, because each reminder sent is logged.

## What the tabs do

- InviteList: the private list. Only you and Natasha edit it.
- Responses: one row per household. Guests answer on the website, and the script writes here. You can also type a reply by hand for a relative who will never use the form. Set source to manual so it is clear.
- Log: records failed code lookups and sent reminders. It holds codes and outcomes only, no names or emails.
- SendList: created by the script when you run exportSendList. It has one message per household, ready to paste, with a sent column for you to tick.
- ManualReminders: created by the script on each reminder run, for households with no email.
- QR: created by the script when you run exportQrList. It feeds the printed invitations later.

## If something goes wrong

- Error "Missing tab": one of the three tabs in step 1 has a different name or is missing. Check the spelling exactly.
- Error "Authorisation required": run the function again and authorise as in step 5.
- The lookup says locked: too many wrong codes were tried in the last 15 minutes. Wait 15 minutes. The lock applies to everyone, because the script cannot see who is asking.
- A household asks for a new code: do not change the code. Ask Natasha or Manny to check the household in InviteList, then send the existing code.

## Things never to do

- Do not paste the spreadsheet link or the Sheet ID into GitHub or any public place. The web app URL is the one exception: it goes into the website code in a later stage, and that is meant to be public.
- Do not share your Google password with anyone or put it in a file. The script never needs it.
- Do not create a New deployment for a change. Use New version instead.
