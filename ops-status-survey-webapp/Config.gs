/**
 * 설문 문항 정의 — 화면(Index.html)과 서버 검증(Code.gs)이 같이 쓴다.
 * 문항을 바꾸면 여기만 고친다. 응답 시트 헤더는 setup() 이 이 순서대로 만든다.
 * (이미 응답이 쌓인 뒤 key 순서를 바꾸면 시트 컬럼이 어긋나니 새 시트로 시작할 것)
 */
var SURVEY = {
  title: '실시간 운영 현황 사용성 설문',

  /** 응답자 기본 정보. 개인정보·협력사 식별정보는 받지 않는다. */
  profile: [
    {
      key: 'region', label: '운영 지역', hint: '운영 중인 지역을 모두 골라 주세요.', type: 'multi', required: true,
      options: ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
                '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
    },
    {
      key: 'contract', label: '계약 유형', type: 'single', required: true,
      options: ['직계약', '중개사']
    },
    {
      key: 'ownSystem', col: '자체·외주 개발 도구', label: '직접 또는 외주로 개발한 웹사이트·앱·프로그램을 쓰고 있나요?',
      hint: '배민커넥트비즈 외에 배달 현황을 확인하려고 만든 도구', type: 'single', required: true,
      options: ['사용하고 있어요', '사용하지 않아요']
    }
  ],

  /**
   * 변화 항목. 각 항목을 5점 척도로 평가한다.
   * skipLabel 이 있는 항목만 척도 대신 고를 수 있는 선택지(예: 해당 없음)를 보여 준다.
   * tag: 신규/개선, before: 이전 화면에서는 어땠는지 (안내 영역에 표시, 없으면 생략)
   */
  changes: [
    { key: 'daily',   tag: '신규', title: '일일 현황',
      desc: '수락률·완료·진행중·취소·거절을 화면 맨 위에서 한눈에',
      before: '라이더 표의 합계 줄에서 직접 확인' },
    { key: 'slot',    tag: '신규', title: '슬롯별 달성률',
      desc: '피크 시간대마다 달성·미달성·진행중 상태와 남은 건수',
      before: '피크별 건수를 표 오른쪽 끝까지 넘겨서 확인' },
    { key: 'weekly',  tag: '신규', title: '이번 주 세트 보기',
      desc: '요일 × 피크별 발주량과 달성 여부를 표 하나로' },
    { key: 'offhours',tag: '신규', title: '시간 외 배달현황',
      desc: '세트가 적용되지 않는 시간의 완료 건수·운행 라이더' },
    { key: 'riders',  tag: '개선', title: '라이더 운행 현황',
      desc: '운행중/운행종료 탭, 검색창 하나로 찾기, SLA 기준 집계와 정렬',
      before: '이름·아이디·휴대폰번호 칸을 따로 채워 검색' },
    { key: 'detail',  tag: '신규', title: '라이더 상세',
      desc: '라이더별 운행 지표, SLA 포함 여부, 시간대별 배달 건수' },
    { key: 'mobile',  tag: '개선', title: '모바일 화면',
      desc: '휴대폰에서도 카드형 화면과 하단 시트로 편하게',
      before: 'PC용 표를 좁은 화면에서 좌우로 넘겨 보기' },
    { key: 'switch',  tag: '개선', title: '협력사 변경',
      desc: '여러 협력사를 운영하면 상단에서 검색해 바로 전환', skipLabel: '해당 없음' }
  ],
  scale: ['매우 불편', '불편', '보통', '편리', '매우 편리'],

  overall: { key: 'overall', label: '바뀐 화면, 전체적으로 어떠세요?' },
  comment: {
    key: 'comment', label: '전체 변화에 대한 의견을 자유롭게 남겨 주세요.',
    placeholder: '좋았던 점, 불편한 점, 더 있었으면 하는 기능 등',
    maxLength: 1000
  }
};
