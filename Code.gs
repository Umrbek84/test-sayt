/**
 * Olimpiadaning viloyat bosqichiga tayyorlanish — test tizimi (Code.gs)
 * Fanlar: Matematika, Kimyo, Biologiya, Fizika, Informatika (9-10-11-sinf)
 * Jadval: "Олимпиадани вилоят босқичига таёрланиш 2026 йил"
 *
 * Varaqlar:
 *   PIN_Codes            A2 = PIN-kod, B2 = "Ochiq" / "Yopiq"
 *   Goliblar             tuman bosqichi gʻoliblari (45 nafar)
 *   Matematika_9 ... Informatika_11   har birida 30 ta savol
 *   Natijalar            test natijalari avtomatik yoziladi
 */

const SPREADSHEET_ID = '1T8TY2d4ENfs3hjPsSn_hCjLp36xgCWL--w9tOpiW2jE';
const FANLAR = ['Matematika', 'Kimyo', 'Biologiya', 'Fizika', 'Informatika'];
const SINFLAR = ['9', '10', '11'];

// ADMIN PANEL PIN-kodi (faqat siz bilasiz). Ochish: ilova manzili oxiriga  ?admin=1  qoʻshing.
const ADMIN_PIN = '7788';   // <-- oʻzgartiring!

/**
 * Ilovaga kirish nuqtasi.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.results) {
    return ContentService.createTextOutput(JSON.stringify(getPublicResults_()))
        .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.admin) {
    return HtmlService.createTemplateFromFile('AdminPanel').evaluate()
        .setTitle('Admin | Olimpiada tayyorgarligi')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Olimpiada tayyorgarligi | Qoʻshkoʻpir')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Katakdagi qiymatni matnga aylantiradi (oʻnli sonlar vergul bilan).
 */
function cellText_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return String(v).trim();
}

/**
 * Goliblar varagʻidan roʻyxatni oladi.
 * Ustunlar: №, Fan, Sinf, Oʻrni, F.I.Sh., Maktab, Tuman bosqichi bali, Oʻqituvchi
 */
function getWinners() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Goliblar');
    if (!sheet) return { success: false, msg: "'Goliblar' varagʻi topilmadi!" };

    const data = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const name = String(r[4] || '').trim();
      if (!name) continue;
      list.push({
        fan: String(r[1]).trim(),
        sinf: String(r[2]).trim(),
        orni: String(r[3]).trim(),
        name: name,
        school: String(r[5] || '').trim()
      });
    }
    return { success: true, data: list };
  } catch (e) {
    return { success: false, msg: 'Xatolik: ' + e.message };
  }
}

/**
 * PIN-kodni tekshirish.
 */
function checkPin(userPin) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const pinSheet = ss.getSheetByName('PIN_Codes');
    const data = pinSheet.getRange('A2:B2').getValues();

    if (String(data[0][0]).trim() === String(userPin).trim() &&
        String(data[0][1]).trim() === 'Ochiq') {
      return { success: true };
    }
    return { success: false, msg: 'PIN xato yoki test vaqti tugagan!' };
  } catch (e) {
    return { success: false, msg: 'Tizim ulanishida xatolik!' };
  }
}

/**
 * Savollarni yuklash. Varaq nomi: <Fan>_<Sinf>, masalan Fizika_10.
 */
function getQuestionsFromServer(fan, sinf) {
  try {
    if (FANLAR.indexOf(fan) === -1 || SINFLAR.indexOf(String(sinf)) === -1) {
      return { success: false, msg: 'Fan yoki sinf notoʻgʻri tanlangan!' };
    }

    const sheetName = fan + '_' + sinf;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("'" + sheetName + "' varagʻi topilmadi!");

    const data = sheet.getDataRange().getValues();
    const questions = [];
    const imgs = IMGS_();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const qText = cellText_(row[0]);
      const correctVal = cellText_(row[5]);
      if (!qText && correctVal === '') continue;

      const kind = cellText_(row[8]).toLowerCase();   // I ustun: son | info | (boʻsh)
      const imgKey = cellText_(row[7]);                // H ustun: rasm kaliti
      const pts = parseFloat(String(row[6]).replace(',', '.')) || 0;
      const img = imgKey ? (imgs[imgKey] || '') : '';

      if (kind === 'info') {
        questions.push({ type: 'info', q: qText, opt: [], correct: null, pts: 0, img: img });
      } else if (kind === 'son') {
        questions.push({ type: 'open', q: qText, opt: [], correct: null, answer: correctVal, pts: pts, img: img });
      } else {
        // Toʻgʻri javob ustunida son boʻlsa — savol, boʻlmasa — matn/maʼlumot bloki
        const isQuestion = correctVal !== '' && !isNaN(parseInt(correctVal, 10));
        questions.push({
          type: isQuestion ? 'question' : 'info',
          q: qText,
          opt: isQuestion ? [1, 2, 3, 4].map(function (k) { return cellText_(row[k]); }) : [],
          correct: isQuestion ? parseInt(correctVal, 10) : null,
          pts: pts,
          img: img
        });
      }
    }

    if (!questions.length) throw new Error("'" + sheetName + "' varagʻida savol yoʻq!");
    return { success: true, data: questions };
  } catch (e) {
    return { success: false, msg: 'Xatolik: ' + e.message };
  }
}

/**
 * Natijani 'Natijalar' varagʻiga yozish.
 */
function processData(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Natijalar') || ss.insertSheet('Natijalar');

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['№', 'Vaqt', 'F.I.Sh.', 'Maktab', 'Sinf', 'Fan', 'Tuman oʻrni', 'Ball', 'Vaqt sarfi', 'Chiqishlar (vkladka)']);
    }

    const stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd.MM.yyyy HH:mm:ss');

    sheet.appendRow([
      sheet.getLastRow(),
      stamp,
      data.name,
      data.school,
      data.grade,
      data.fan,
      data.orni,
      Number(data.score),
      data.timeTaken,
      data.cheats
    ]);

    // Har bir oʻquvchining javoblari alohida varaqqa yoziladi (admin panel uchun)
    let js = ss.getSheetByName('Javoblar');
    if (!js) {
      js = ss.insertSheet('Javoblar');
      js.appendRow(['ID', 'Vaqt', 'F.I.Sh.', 'Maktab', 'Sinf', 'Fan', 'Ball', 'Javoblar (JSON)', 'Savol vaqtlari (JSON)']);
    }
    js.appendRow([
      js.getLastRow(), stamp, data.name, data.school, data.grade, data.fan, Number(data.score),
      String(data.answers || '{}').substring(0, 45000), String(data.times || '{}').substring(0, 45000)
    ]);
    return 'OK';
  } catch (e) {
    return e.message;
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/** Rasmlar (Images1.gs, Images2.gs fayllaridan) bitta xaritaga birlashtiriladi. */
function IMGS_() {
  var all = {};
  [typeof IMGS1_ === 'function' ? IMGS1_() : {}, typeof IMGS2_ === 'function' ? IMGS2_() : {}].forEach(function (m) {
    for (var k in m) all[k] = m[k];
  });
  return all;
}


// ====================== ADMIN PANEL ======================

function stampText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone(), 'dd.MM.yyyy HH:mm:ss');
  return String(v);
}

function adminCheck_(pin) {
  if (String(pin).trim() !== String(ADMIN_PIN)) throw new Error('Admin PIN-kod notoʻgʻri!');
}

/** Barcha urinishlar roʻyxati (yangilari tepada). */
function adminList(pin) {
  try {
    adminCheck_(pin);
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Javoblar');
    if (!sh || sh.getLastRow() < 2) return { success: true, data: [] };
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
    const out = rows.map(function (r) {
      return { id: r[0], stamp: stampText_(r[1]), name: r[2], school: r[3], grade: String(r[4]), fan: r[5], score: r[6] };
    }).reverse();
    return { success: true, data: out };
  } catch (e) { return { success: false, msg: e.message }; }
}

/** Bitta urinishning toʻliq tahlili: savollar + oʻquvchi javoblari. */
function adminAttempt(pin, id) {
  try {
    adminCheck_(pin);
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Javoblar');
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
    let r = null;
    for (let i = 0; i < rows.length; i++) { if (String(rows[i][0]) === String(id)) { r = rows[i]; break; } }
    if (!r) throw new Error('Urinish topilmadi');
    const grade = String(r[4]).replace('-sinf', '');
    const q = getQuestionsFromServer(r[5], grade);
    if (!q.success) throw new Error(q.msg);
    return {
      success: true,
      info: { stamp: stampText_(r[1]), name: r[2], school: r[3], grade: String(r[4]), fan: r[5], score: r[6] },
      answers: JSON.parse(r[7] || '{}'),
      times: JSON.parse(r[8] || '{}'),
      questions: q.data
    };
  } catch (e) { return { success: false, msg: e.message }; }
}


// ====================== OMMAVIY NATIJALAR (saytdagi "Natijalar" boʻlimi) ======================

/** Natijalar varagʻidan roʻyxat (sayt ?results=1 orqali oʻqiydi). 60 soniya keshlanadi. */
function getPublicResults_() {
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get('pubres');
    if (hit) return JSON.parse(hit);
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Natijalar');
    let out = [];
    if (sh && sh.getLastRow() > 1) {
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
      rows.forEach(function (r) {
        if (!String(r[2]).trim()) return;
        out.push({
          date: stampText_(r[1]), name: String(r[2]).trim(), school: String(r[3]).trim(),
          sinf: String(r[4]).replace('-sinf', '').trim(), fan: String(r[5]).trim(),
          ball: Number(String(r[7]).replace(',', '.')) || 0
        });
      });
    }
    const res = { success: true, data: out };
    try { cache.put('pubres', JSON.stringify(res), 60); } catch (x) {}
    return res;
  } catch (e) { return { success: false, msg: e.message }; }
}
