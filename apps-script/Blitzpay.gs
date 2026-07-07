/**
 * BlitzPay Free Transfer - OPay Email Checker
 * Deploy as Web App (execute as me, access anyone)
 * Add Script Property: FT_SCRIPT_SECRET
 * Set a time-driven trigger for checkOpayEmails() every 2 minutes
 */

const SUPABASE_WEBHOOK_URL = 'https://tljnhlhzyntotadxoypz.supabase.co/functions/v1/opay-email-webhook';
const OPAY_SENDERS = ['no-reply@opay.com', 'noreply@opay.com', 'opay@opay.com', 'notifications@opay.com'];
const OPAY_SUBJECTS = ['credit alert', 'debit alert', 'transfer', 'received', 'payment'];

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  const secret = PropertiesService.getScriptProperties().getProperty('FT_SCRIPT_SECRET');
  if (data.secret && data.secret !== secret) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const result = checkOpayEmails();
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'BlitzPay Free Transfer email checker is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'checkOpayEmails') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('checkOpayEmails')
    .timeBased()
    .everyMinutes(2)
    .create();
  Logger.log('Trigger set for every 2 minutes');
}

function checkOpayEmails() {
  const secret = PropertiesService.getScriptProperties().getProperty('FT_SCRIPT_SECRET');
  if (!secret) {
    Logger.log('Missing FT_SCRIPT_SECRET script property');
    return { error: 'missing_secret', emails_processed: 0 };
  }

  const processedLabelName = 'BlitzPayProcessed';
  let label = GmailApp.getUserLabelByName(processedLabelName);
  if (!label) {
    label = GmailApp.createLabel(processedLabelName);
  }

  const threads = GmailApp.search('is:unread', 0, 50);
  let processed = 0;
  let matched = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      if (message.isUnread() && !hasLabel(message, label)) {
        const sender = message.getFrom().toLowerCase();
        const subject = message.getSubject().toLowerCase();
        const body = message.getPlainBody();
        const isOpay = OPAY_SENDERS.some(s => sender.includes(s)) ||
                       OPAY_SUBJECTS.some(s => subject.includes(s)) ||
                       body.toLowerCase().includes('opay');

        if (isOpay) {
          const parsed = parseOpayEmail(subject, body);
          if (parsed.amount > 0) {
            sendToWebhook(parsed, secret);
            matched++;
          }
        }
        processed++;
        message.markRead();
        thread.addLabel(label);
      }
    }
  }

  Logger.log('Done. Processed: ' + processed + ', Matched: ' + matched);
  return { emails_processed: processed, matched: matched };
}

function hasLabel(message, label) {
  const labels = message.getThread().getLabels();
  for (const l of labels) {
    if (l.getName() === label.getName()) return true;
  }
  return false;
}

function parseOpayEmail(subject, body) {
  const text = subject + ' ' + body;
  const lower = text.toLowerCase();

  let amount = 0;
  const amountRegex = /(?:NGN|₦|N)\s*([0-9,]+\.?\d{0,2})/i;
  const amountMatch = text.match(amountRegex);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  let senderName = '';
  const senderRegexes = [
    /(?:from|sender|transfer from|sent by)[\s:]*([A-Z][A-Za-z\s]{2,40})/i,
    /(?:description|narration|remark)[\s:]*([A-Za-z0-9\s]{5,60})/i,
    /(?:account name)[\s:]*([A-Z][A-Za-z\s]{2,40})/i
  ];
  for (const r of senderRegexes) {
    const m = text.match(r);
    if (m) {
      senderName = m[1].trim();
      break;
    }
  }

  let bankName = '';
  const bankRegex = /(?:bank)[\s:]*([A-Za-z\s]{2,30})/i;
  const bankMatch = text.match(bankRegex);
  if (bankMatch) bankName = bankMatch[1].trim();

  let accountDigits = '';
  const digitRegex = /(?:account number|acct no|acct number|a\/c)[\s:]*(\d{10,11})/i;
  const digitMatch = text.match(digitRegex);
  if (digitMatch) accountDigits = digitMatch[1];

  return {
    amount: amount,
    sender_name: senderName,
    bank_name: bankName,
    account_digits: accountDigits,
    raw_subject: subject.slice(0, 200),
    raw_body: body.slice(0, 500)
  };
}

function sendToWebhook(parsed, secret) {
  const payload = {
    secret: secret,
    ...parsed
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const resp = UrlFetchApp.fetch(SUPABASE_WEBHOOK_URL, options);
  Logger.log('Webhook response: ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 100));
}
