# CLAUDE.md — 3PL 협력사 프로파일 대시보드

이 파일은 Claude Code가 매 세션 자동으로 읽는 프로젝트 컨텍스트다. 작업 전 반드시 숙지할 것.

## 프로젝트 개요
- 우아한청년들(라스트마일 배송) **영업팀용** 3PL 협력사 프로파일 관리 대시보드.
- **단일 파일** `index.html` (약 6,900+줄, 바닐라 JS / 인라인 SVG 차트 / CSS 변수 기반 라이트·다크 테마).
- 데이터는 **Google Sheets** 를 OAuth 로 읽고 쓴다 (Sheets API v4).
- 배포: **GitHub Pages** (repo `github.com/cykim1991-create/3pl-Profile-dashboard`, `cykim1991-create.github.io`).
- 참고용 `Code.gs` / `활동로그_AppScript.gs` 는 과거 Apps Script 방식 잔재. **현재 런타임 경로 아님** (Apps Script 웹앱은 보안 조치로 배포 해제됨). 신규 작업은 `index.html` + Sheets API 경로만 손댄다.

## 핵심 아키텍처
- **인증**: Google OAuth 2.0 GIS 토큰 모델. refresh token 없음, 액세스 토큰 1시간, `prompt:''` 로 무음 재인증.
  - 토큰은 **절대 디스크/localStorage 에 저장하지 않음** (메모리 전용). 이 규칙 깨지 말 것.
  - 계정 허용목록(`허용계정` 탭) 을 **토큰 발급 시마다** 재검증.
  - 세션 타임아웃 `SESSION_TIMEOUT_MS = 12h`.
- **초기화**: `_dashboardReady()`(실제 `#app` 가시성 기준) + `_runInitOnce()`(동시성 가드) 로 로그인 게이트 처리. 예전 `_appInitialized` 플래그 방식은 UI 와 desync 버그가 있어 폐기됨 — 되살리지 말 것.
- **읽기**: 모든 시트 읽기는 Bearer 토큰 OAuth. 초기 로드는 `Promise.all([fetchSheet(...), ...])`.
- **RGN2 매핑**: `협력사기본정보.권역명` → `RGN2정보` 시트로 매핑 → `p['RGN2']`. `STATE.rgn2Info` 전역 맵. (예: `표준경기의왕C` = `경기도_의왕시`)

## 사용 시트 (탭명 / 범위)
- `협력사기본정보` A:L
- `데일리운영현황` A:V (22열, V=SLA시간대외_처리건수)
- `실시간운행현황` A:AZ — 소스는 **`today_new`** (기존 28열 + 신규 7열: `sla_complete_count`, `not_sla_complete_count`, `value_ml2/pl2/d2/pd2`, `rejected_count`)
- `활동로그`, `RGN2_담당자`, `RGN2_일별지표`(A:J, "최근 7일 슬라이딩"), `협력사연락처`, `RGN2정보`, `운영중지대상`, `운영중지_유예결정`, `완화이력`(A:H)
- KPI 보존기간: 최근 **4주** (`filterKPIRecent(allKPI, 4)`).
- ⚠️ `RGN2_일별지표` 는 소스 자체가 최근 7일만 제공 → 품질 그래프가 2주를 다 못 채우는 건 코드 버그 아님(데이터 한계).
- ⚠️ `RGN2_일별지표` 는 같은 날짜·지역 중복 행 존재 → **맨 처음 행 기준**으로 사용.

## 도메인 규칙 (자주 실수하는 지점)
- **퍼센트**: 시트 값이 `0.7` 이든 `70` 이든 `_parsePercent` 는 **항상 그대로 퍼센트 단위로 취급** (항상 `/100` 아님 — 시트는 항상 퍼센트 단위 저장). ratio 로 재해석하지 말 것.
- **협력사 퍼포먼스 리스트 노출 기준**: 운영상태 무관, `데일리운영현황`에 (보존기간 내) 운행 이력 있는 협력사 전부. "운행만" 버튼 = 운영중 필터. (구 "위험만" 버튼은 삭제됨.)
- **실시간운행현황 리스트**: 보존기간 내 운행 이력 있으면 노출.
- **등급 표기**: 항상 협력사 프로파일 기준 등급 사용 (운영중지 리스트 등 다른 곳도 프로파일 등급으로 통일).
- **운영상태 뱃지 색**: 운영중=정상, `운영정지`=빨강(`badge-risk` ⛔), `준비중`=노랑(`badge-onb` 🟡).
- **품질 그래프**: 5개 차트(UTR 제거), 2주 윈도우, 요일 라벨 `6/29(월)`. 데이터 순서 = 3PL처리비중 → 액티브협력사수 → 운행라이더수 → DCPO → 60분초과율. RGN1 min/max 밴드는 처리비중·액티브·60분 3개에만(라이더·DCPO 는 지역 데이터만). 화성시 제외.
- **완화이력**: 지역=전국/RGN1전체/특정RGN2. 내용 포맷 발주량=`20%`, 수락률=`종일` 또는 `시간대: 아침점심·저녁피크`. 컬럼 `ID|일자|RGN1|RGN2|완화유형|완화내용|작성자|작성일시`.

## 검증 워크플로 (필수)
편집 후 매번 인라인 `<script>` 블록 문법 체크를 돌린다:
```bash
node -e '
const fs=require("fs");
const html=fs.readFileSync("index.html","utf8");
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,i=0,ok=true;
while((m=re.exec(html))){ i++; try{ new Function(m[1]); }catch(e){ ok=false; console.log("BLOCK #"+i,e.message);} }
console.log(ok?"OK":"SYNTAX ERR");
'
```
- 셸 single-quote / 정규식 특수문자 이스케이프 때문에 검증 스크립트가 false-negative 를 잘 낸다. grep 결과가 이상하면 스크립트가 아니라 escaping 을 의심할 것.

## 보안 / 조직 규칙 (우아한청년들)
- 산출물·코드에 개인/민감정보(이름, 이메일, 주민등록번호, 여권번호, 전화번호, CI/DI, 계좌·카드번호) 또는 크리덴셜(비밀번호, API 키, 토큰) 포함 금지.
- 시트는 도메인 제한 공유, OAuth 전용 읽기, CSP meta 헤더 적용됨.
- 웹 콘텐츠는 승인된 fetch 도구만 사용, curl/wget/타 언어 HTTP 우회 금지.
- 보안 문의: Slack `#support-정보보안` 또는 `wy_information_security@woowayouths.com`.

## 배포
- `git commit` → `git push` → GitHub Pages 자동 반영. `gh` CLI 사용 가능.
- 기본 브랜치에 직접 커밋 말고 브랜치 분리 후 작업할 것.

## 커뮤니케이션
- 답변은 간결·직접적으로. 불필요한 설명 최소화.
