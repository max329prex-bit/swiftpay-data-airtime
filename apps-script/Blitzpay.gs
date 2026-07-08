const SUPABASE_WEBHOOK_URL = 'https://tljnhlhzyntotadxoypz.supabase.co/functions/v1/opay-email-webhook';
const OPAY_SENDERS = ['no-reply@opay.com', 'noreply@opay.com', 'opay@opay.com', 'notifications@opay.com'];
const OPAY_SUBJECTS = ['credit alert', 'debit alert', 'transfer', 'received', 'payment'];
const BLITZPAY_ACCOUNTS = ['6554098879', '6616057979'];

function doPost(e) {
  ensureTrigger();
  const data = JSON.parse(e.postData.contents || '{}');
  const secret = PropertiesService.getScriptProperties().getProperty('FT_SCRIPT_SECRET');
  if (data.secret && data.secret !== secret) {
    return jsonResponse({ error: 'unauthorized' });
  }
  return jsonResponse(checkOpayEmails());
}

function doGet(e) {
  ensureTrigger();
  return jsonResponse({ status: 'ok', message: 'BlitzPay Free Transfer email checker is running' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkOpayEmails') {
      return;
    }
  }
  ScriptApp.newTrigger('checkOpayEmails').timeBased().everyMinutes(2).create();
  Logger.log('Trigger created for checkOpayEmails');
}

function checkOpayEmails() {
  const secret = PropertiesService.getScriptProperties().getProperty('FT_SCRIPT_SECRET');
  if (!secret) {
    Logger.log('Missing FT_SCRIPT_SECRET script property');
    return { error: 'missing_secret', emails_processed: 0 };
  }

  const labelName = 'BlitzPayProcessed';
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }

  const threads = GmailApp.search('is:unread', 0, 50);
  let processed = 0;
  let matched = 0;

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      if (message.isUnread() && !hasLabel(message, label)) {
        const sender = message.getFrom().toLowerCase();
        const subject = message.getSubject().toLowerCase();
        const body = message.getPlainBody();
        const isOpay = isOpayEmail(sender, subject, body);

        if (isOpay) {
          const parsed = parseOpayEmail(subject, body);
          if (parsed.amount > 0) {
            sendToWebhook(parsed, secret);
            matched++;
          }
        }
        processed++;
        message.markRead();
        threads[i].addLabel(label);
      }
    }
  }

  Logger.log('Done. Processed: ' + processed + ', Matched: ' + matched);
  return { emails_processed: processed, matched: matched };
}

function hasLabel(message, label) {
  const labels = message.getThread().getLabels();
  for (let i = 0; i < labels.length; i++) {
    if (labels[i].getName() === label.getName()) {
      return true;
    }
  }
  return false;
}

function isOpayEmail(sender, subject, body) {
  for (let i = 0; i < OPAY_SENDERS.length; i++) {
    if (sender.indexOf(OPAY_SENDERS[i]) > -1) return true;
  }
  for (let i = 0; i < OPAY_SUBJECTS.length; i++) {
    if (subject.indexOf(OPAY_SUBJECTS[i]) > -1) return true;
  }
  return body.indexOf('opay') > -1;
}

function parseOpayEmail(subject, body) {
  const text = subject + ' ' + body;

  let amount = 0;
  const amountMatch = text.match(/(?:NGN|₦|N)\s*([0-9,]+\.?\d{0,2})/i);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  let senderName = '';
  const nameMatches = [
    text.match(/(?:from|sender|transfer from|sent by)[\s:]*([A-Z][A-Za-z\s]{2,40})/i),
    text.match(/(?:description|narration|remark)[\s:]*([A-Za-z0-9\s]{5,60})/i),
    text.match(/(?:account name)[\s:]*([A-Z][A-Za-z\s]{2,40})/i)
  ];
  for (let i = 0; i < nameMatches.length; i++) {
    if (nameMatches[i]) {
      senderName = nameMatches[i][1].trim();
      break;
    }
  }

  let bankName = '';
  const bankMatch = text.match(/(?:bank)[\s:]*([A-Za-z\s]{2,30})/i);
  if (bankMatch) {
    bankName = bankMatch[1].trim();
  }

  let accountDigits = '';
  const digitsMatch = text.match(/(?:account number|acct no|acct number|a\/c)[\s:]*(\d{10,11})/i);
  if (digitsMatch) {
    accountDigits = digitsMatch[1];
  }

  let receiptAccount = '';
  const receiptMatch = text.match(/(?:to|recipient|receipt|credited to|into|account number)[\s:]*(\d{10,11})/i);
  if (receiptMatch) {
    receiptAccount = receiptMatch[1];
  }

  return {
    amount: amount,
    sender_name: senderName,
    bank_name: bankName,
    account_digits: accountDigits,
    receipt_account: receiptAccount,
    raw_subject: subject.slice(0, 200),
    raw_body: body.slice(0, 500)
  };
}

function sendToWebhook(parsed, secret) {
  // Ignore emails that are not transfers into a BlitzPay account.
  const rcpt = String(parsed.receipt_account || '').replace(/\D/g, '');
  if (rcpt && !BLITZPAY_ACCOUNTS.some(a => rcpt.includes(a))) {
    Logger.log('Skipping: not a BlitzPay receipt account: ' + rcpt);
    return;
  }

  const payload = {
    secret: secret,
    amount: parsed.amount,
    sender_name: parsed.sender_name,
    bank_name: parsed.bank_name,
    sender_account: parsed.account_digits,
    receipt_account: parsed.receipt_account,
    raw_subject: parsed.raw_subject,
    raw_body: parsed.raw_body
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
