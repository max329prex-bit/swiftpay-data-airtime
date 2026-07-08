const SUPABASE_WEBHOOK_URL = 'https://tljnhlhzyntotadxoypz.supabase.co/functions/v1/opay-email-webhook';
const OPAY_SENDERS = ['no-reply@opay-nigeria.com', 'no-reply@opay.com', 'noreply@opay.com', 'opay@opay.com', 'notifications@opay.com'];
const OPAY_SUBJECTS = ['credit alert', 'debit alert', 'transfer', 'received', 'payment'];
const BLITZPAY_ACCOUNTS = ['6554098879', '6616057979'];

function doPost(e) {
  ensureTrigger();
  const data = JSON.parse(e.postData.contents || '{}');
  const secret = PropertiesService.getScriptProperties().getProperty('FT_SCRIPT_SECRET');
  if (!secret || data.secret !== secret) {
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

  // Only look at unread emails from OPay senders. Do not touch other emails.
  const senderQueries = OPAY_SENDERS.map(s => 'from:' + s).join(' OR ');
  const query = 'is:unread (' + senderQueries + ')';
  const threads = GmailApp.search(query, 0, 50);
  let processed = 0;
  let matched = 0;
  let skipped = 0;

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      if (!message.isUnread() || hasLabel(message, label)) {
        continue;
      }

      const sender = message.getFrom().toLowerCase();
      const subject = message.getSubject().toLowerCase();
      const body = message.getPlainBody();
      const isOpay = isOpayEmail(sender, subject, body);

      if (!isOpay) {
        // Not a transfer into BlitzPay: leave unread for the main cron.
        skipped++;
        continue;
      }

      const parsed = parseOpayEmail(subject, body);
      if (parsed.amount <= 0) {
        skipped++;
        continue;
      }

      const sent = sendToWebhook(parsed, secret, message.getId());
      processed++;
      if (sent) {
        matched++;
        message.markRead();
        threads[i].addLabel(label);
      } else {
        Logger.log('Leaving unread for retry: amount=' + parsed.amount);
      }
    }
  }

  Logger.log('Done. Processed: ' + processed + ', Matched: ' + matched + ', Skipped: ' + skipped);
  return { emails_processed: processed, matched: matched, skipped: skipped };
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
  if (body.indexOf('opay') === -1) return false;
  for (let i = 0; i < OPAY_SUBJECTS.length; i++) {
    if (subject.indexOf(OPAY_SUBJECTS[i]) > -1) return true;
  }
  return false;
}

function parseOpayEmail(subject, body) {
  const text = subject + ' ' + body;

  function firstMatch(patterns) {
    for (let i = 0; i < patterns.length; i++) {
      const m = text.match(patterns[i]);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  }

  const amountMatch = firstMatch([
    /Amount[\s:]*₦?\s*([0-9,]+\.?\d{0,2})/i,
    /(?:NGN|₦|N)\s*([0-9,]+\.?\d{0,2})/i,
    /([0-9,]+\.\d{2})\s*(?:NGN|₦)/i
  ]);
  const amount = amountMatch ? parseFloat(amountMatch.replace(/,/g, '')) : 0;

  const senderName = firstMatch([
    /(?:from|sender|sender name|transfer from|sent by)[\s:]*([A-Z][A-Za-z\s,.'-]{2,60})/i,
    /(?:account name)[\s:]*([A-Z][A-Za-z\s,.'-]{2,60})/i,
    /(?:description|narration|remark)[\s:]*([A-Za-z0-9\s,.'-]{5,80})/i,
    /Dear\s+([A-Z][A-Za-z\s,.'-]{2,60}),/i
  ]);

  const bankName = firstMatch([
    /Bank\s*Name[\s:]*([A-Za-z\s,.'-]{2,40})/i,
    /Source\s*Bank[\s:]*([A-Za-z\s,.'-]{2,40})/i,
    /From\s*Bank[\s:]*([A-Za-z\s,.'-]{2,40})/i,
    /(?:sender|source)\s+bank[\s:]*([A-Za-z\s,.'-]{2,40})/i,
    /Bank[\s:]*([A-Za-z\s,.'-]{2,40})/i
  ]);

  let accountDigits = firstMatch([
    /(?:sender|source)\s*Account[\s:]*([\d*]{7,20})/i,
    /(?:account number|acct no|acct number|a\/c)[\s:]*([\d*]{7,20})/i,
    /Account[\s:]*([\d*]{7,20})/i
  ]);

  // Clean up masked accounts like 8130****0557 (remove spaces in the mask)
  if (accountDigits) {
    accountDigits = accountDigits.replace(/\s/g, '');
  }

  const receiptAccount = firstMatch([
    /(?:to|recipient|receipt|credited to|beneficiary)[\s:]*(\d{10,11})/i,
    /Receipt\s*account[\s:]*(\d{10,11})/i,
    /(?:account number|acct no)[\s:]*(\d{10,11})/i
  ]);

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

function sendToWebhook(parsed, secret, gmailMessageId) {
    const rcpt = String(parsed.receipt_account || '').replace(/\D/g, '');
    if (rcpt && !BLITZPAY_ACCOUNTS.some(a => rcpt.includes(a))) {
      Logger.log('Skipping: not a BlitzPay receipt account: ' + rcpt);
      return false;
    }

    const payload = {
      secret: secret,
      gmail_message_id: gmailMessageId || '',
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
      headers: { 'x-script-secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const resp = UrlFetchApp.fetch(SUPABASE_WEBHOOK_URL, options);
    const code = resp.getResponseCode();
    const respBody = resp.getContentText();
    Logger.log('Webhook response: ' + code + ' ' + respBody.slice(0, 200));
    if (code < 200 || code >= 300) {
      Logger.log('Webhook FAILED for gmail_id=' + gmailMessageId + ' amount=' + parsed.amount);
      return false;
    }
    try {
      const json = JSON.parse(respBody);
      return json.success === true;
    } catch(e) {
      return true;
    }
}
