/**
 * 실시간 운영 현황(구 배달현황) 개편 안내 + 사용성 설문 웹앱
 *
 * 협력사(외부)가 로그인 없이 응답한다. 응답은 배포자 권한으로 응답 시트에 한 줄씩 쌓인다.
 * 받는 정보: 운영 지역 · 계약 유형 · 자체/외주 개발 도구 사용 여부 · 항목별 평가 · 의견.
 * 이름·연락처·협력사명·ID 같은 식별정보는 받지 않고, 접속자 계정도 기록하지 않는다.
 *
 * 배포: README.md 참고 (setup 1회 실행 → 웹 앱 배포)
 */

var SHEET_TAB = '응답';
var PROP_SHEET_ID = 'SHEET_ID';

/** 같은 화면에서 두 번 누른 제출을 막는 기간 */
var DEDUPE_TTL_SEC = 6 * 60 * 60;
/** 분당 전체 제출 상한. 넘으면 잠시 후 다시 시도하도록 안내한다 (무작위 대량 제출 방지). */
var MAX_SUBMITS_PER_MIN = 60;

function doGet() {
  var t = HtmlService.createTemplateFromFile('Index');
  // </script> 로 스크립트 블록이 끊기지 않게 '<' 를 이스케이프한다
  t.configJson = JSON.stringify(SURVEY).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle(SURVEY.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 클라이언트 제출 진입점.
 * @param {Object} form { submissionId, website(허니팟), region[], contract, ownSystem, changes{key:점수|'skip'}, overall, comment }
 * @return {{ok: boolean}}
 */
function submitSurvey(form) {
  form = form || {};
  // 사람 눈에 안 보이는 입력칸이 채워졌으면 봇으로 보고 저장 없이 성공 응답만 준다
  if (form.website) return { ok: true };

  var row = validate_(form);
  var cache = CacheService.getScriptCache();
  var dedupeKey = 'sub_' + row.id;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('응답이 몰리고 있어요. 잠시 후 다시 제출해 주세요.');
  try {
    if (cache.get(dedupeKey)) return { ok: true };

    var minuteKey = 'rate_' + Math.floor(Date.now() / 60000);
    var n = Number(cache.get(minuteKey) || 0);
    if (n >= MAX_SUBMITS_PER_MIN) throw new Error('응답이 몰리고 있어요. 1분 뒤 다시 제출해 주세요.');

    sheet_().appendRow(row.values);
    cache.put(minuteKey, String(n + 1), 120);
    cache.put(dedupeKey, '1', DEDUPE_TTL_SEC);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/** 허용된 선택지만 통과시키고 시트 한 줄로 만든다. 잘못된 값이면 예외. */
function validate_(f) {
  var id = String(f.submissionId || '');
  if (!/^[a-z0-9]{12,40}$/i.test(id)) throw new Error('잘못된 요청입니다. 화면을 새로고침해 주세요.');

  var values = [Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')];

  SURVEY.profile.forEach(function (q) {
    var v = f[q.key];
    if (q.type === 'multi') {
      var picked = (Array.isArray(v) ? v : []).filter(function (x) { return q.options.indexOf(x) >= 0; });
      picked = q.options.filter(function (o) { return picked.indexOf(o) >= 0; });   // 보기 순서로 정렬·중복 제거
      if (q.required && !picked.length) throw new Error(q.label + '을(를) 선택해 주세요.');
      values.push(picked.join(', '));
    } else {
      if (q.options.indexOf(v) < 0) {
        if (q.required) throw new Error(q.label + '을(를) 선택해 주세요.');
        v = '';
      }
      values.push(v);
    }
  });

  var changes = f.changes || {};
  SURVEY.changes.forEach(function (c) {
    var v = changes[c.key];
    if (v === 'skip') { values.push(c.skipLabel || SURVEY.skipLabel); return; }
    var s = Number(v);
    if (!(s >= 1 && s <= SURVEY.scale.length && s % 1 === 0)) throw new Error('"' + c.title + '" 항목을 평가해 주세요.');
    values.push(s);
  });

  var o = Number(f.overall);
  if (!(o >= 1 && o <= SURVEY.scale.length && o % 1 === 0)) throw new Error('전체 만족도를 선택해 주세요.');
  values.push(o);

  values.push(cleanText_(f.comment, SURVEY.comment.maxLength));
  values.push(id);
  return { id: id, values: values };
}

/** 줄바꿈 정리 · 길이 제한 · 수식 주입 방지 (=, +, -, @ 로 시작하면 앞에 ' 를 붙인다) */
function cleanText_(s, max) {
  var t = String(s || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
  if (t.length > max) t = t.slice(0, max);
  if (/^[=+\-@\t]/.test(t)) t = "'" + t;
  return t;
}

function header_() {
  var h = ['제출일시'];
  SURVEY.profile.forEach(function (q) { h.push(q.col || q.label); });
  SURVEY.changes.forEach(function (c) { h.push(c.title); });
  h.push('전체 만족도', '의견', '제출ID');
  return h;
}

function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
  if (!id) throw new Error('설문 준비 중입니다. 잠시 후 다시 시도해 주세요.');
  var sh = SpreadsheetApp.openById(id).getSheetByName(SHEET_TAB);
  if (!sh) throw new Error('설문 준비 중입니다. 잠시 후 다시 시도해 주세요.');
  return sh;
}

/**
 * 편집기에서 1회 실행(▶). 응답 시트를 새로 만들고 ID 를 스크립트 속성에 저장한다.
 * 이미 SHEET_ID 가 있으면 그 시트의 헤더만 확인한다.
 * 시트는 배포자 드라이브에 생성되며 공유 설정은 바꾸지 않는다 (사내 담당자에게만 직접 공유).
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create(SURVEY.title + ' 응답');
  var sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName(SHEET_TAB);
  }
  if (sh.getLastRow() === 0) {
    var h = header_();
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  props.setProperty(PROP_SHEET_ID, ss.getId());
  Logger.log('응답 시트: %s', ss.getUrl());
}

/** 편집기에서 실행해 항목별 평균·응답 수를 실행 기록으로 확인한다. */
function summary() {
  var v = sheet_().getDataRange().getValues();
  var head = v[0], rows = v.slice(1);
  Logger.log('응답 %s건', rows.length);
  var from = 1 + SURVEY.profile.length;
  for (var c = from; c < from + SURVEY.changes.length + 1; c++) {
    var nums = rows.map(function (r) { return r[c]; }).filter(function (x) { return typeof x === 'number'; });
    var avg = nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : 0;
    Logger.log('%s: 평균 %s (평가 %s건 / 미사용 %s건)', head[c], avg.toFixed(2), nums.length, rows.length - nums.length);
  }
}
