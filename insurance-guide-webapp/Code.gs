/**
 * 협력사 사장님 대상 유상운송보험 가입 확인 안내 페이지
 *
 * 읽기 전용 안내 페이지. 입력·저장·접속 기록이 없다.
 * 배포: README.md 참고
 */

var PAGE_TITLE = '유상운송보험·교통안전교육 확인 안내 | 배민커넥트비즈';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(PAGE_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
