import type { MsgId } from './en.js';

/** 한국어 메시지 카탈로그. en.ts 와 id 집합·{자리표시자}가 같아야 한다(테스트로 검사). */
export const ko: Record<MsgId, string> = {
  'help.text': `next-route-impact - 코드 변경이 닿는 URL 과 API 를 찾아 줍니다

사용법:
  next-route-impact [옵션] [파일|폴더 ...]

옵션:
  --git                 git 에서 바뀐 파일을 가져옵니다 (--base 와의 merge-base, 스테이징, 작업 트리, 미추적 파일)
  --base <ref>          --git 의 기준 ref (기본: origin/HEAD, origin/main, main, master)
  --root <dir>          Next.js 앱 루트 (기본: 현재 폴더)
  --config <path>       설정 파일 (기본: next-route-impact.config.json 또는 package.json 의 "nextRouteImpact")
  --json                JSON 으로 출력
  --markdown            마크다운으로 출력 (PR 댓글용)
  --tests               돌릴 테스트 파일 출력 (설정의 "tests" 매핑 필요)
  --include-types       타입 전용 import 도 따라감
  --fail-on-uncertain   불확실하거나 해석 못 한 항목이 있으면 종료 코드 3
  --lang <en|ko>        출력 언어 (기본: ROUTE_IMPACT_LANG, LC_ALL, LC_MESSAGES, LANG 순)
  -h, --help            이 도움말 보기
  -v, --version         버전 보기

종료 코드: 0 정상, 1 실행 오류, 2 사용법 오류, 3 불확실 항목 있음 (--fail-on-uncertain)`,

  'error.unknownOption': '알 수 없는 옵션 {option} 입니다. --help 로 사용할 수 있는 옵션을 확인하세요.',
  'error.missingValue': '옵션 {option} 에 값이 필요합니다. --help 로 사용법을 확인하세요.',
  'error.unexpectedValue': '옵션 {option} 은(는) 값을 받지 않습니다. --help 로 사용법을 확인하세요.',
  'error.invalidLang': '지원하지 않는 언어 "{value}" 입니다. --lang en 또는 --lang ko 를 쓰세요.',
  'error.formatConflict': '출력 형식은 하나만 고르세요: --json 과 --markdown 은 함께 쓸 수 없습니다.',
  'error.noInput': '분석할 대상이 없습니다. --git 를 주거나 바뀐 파일을 적으세요: next-route-impact src/lib/format.ts',
  'error.rootNotFound': '앱 루트 "{root}" 가 없거나 폴더가 아닙니다. --root 를 확인하세요.',
  'error.noRoutes': '"{root}" 에서 app/ 또는 pages/ 폴더를 찾지 못했습니다(src/ 도 확인함). --root 를 Next.js 앱 폴더로 지정하세요.',
  'error.notGitRepo': '"{root}" 폴더는 git 저장소 안에 있지 않아 --git 로 변경을 읽을 수 없습니다. 대신 파일 경로를 직접 주세요.',
  'error.gitMissing': 'git 명령을 찾을 수 없습니다. git 을 설치하거나 --git 대신 파일 경로를 주세요.',
  'error.baseNotFound': '기준 ref "{base}" 가 없습니다. 먼저 가져오거나(fetch) --base 로 다른 ref 를 고르세요.',
  'error.noMergeBase': '"{base}" 와 HEAD 사이에 공통 조상이 없습니다. CI 에서는 얕은 clone 일 가능성이 큽니다: actions/checkout 에 fetch-depth: 0 을 쓰세요.',
  'error.gitFailed': '"{root}" 에서 git 변경 목록을 읽지 못했습니다. 그 폴더에서 git status 로 상태를 확인하세요.',
  'error.configSyntax': '설정 파일 "{file}" 이(가) 올바른 JSON 이 아닙니다. 문법을 고친 뒤 다시 실행하세요.',
  'error.configShape': '"{file}" 설정이 올바르지 않습니다: "{field}" 항목이 유효하지 않습니다. README 의 "설정 파일" 절을 보세요.',
  'error.configNotFound': '설정 파일 "{file}" 이(가) 없습니다. --config 를 확인하세요.',
  'error.testsNoMapping': '--tests 에는 설정 파일의 "tests" 매핑(URL 글롭 → 테스트 글롭)이 필요합니다.',
  'error.fileNotFound': '파일 "{file}" 이(가) 없습니다. 경로 오타를 확인하세요. 삭제된 파일이면 목록에서 빼거나 --git 으로 삭제를 확인하세요.',
  'error.unreadableDir': '폴더 "{dir}" 을(를) 읽을 수 없습니다(권한 문제일 수 있습니다). 권한을 고치거나 앱 전체를 읽을 수 있는 사용자로 실행하세요.',
  'error.unexpected': '예상하지 못한 오류: {detail}',

  'table.url': 'URL',
  'table.kind': '종류',
  'table.reason': '이유',
  'kind.page': '페이지',
  'kind.api': 'API',
  'kind.metadata': '메타데이터',
  'edge.reexport': '재수출',
  'edge.dynamic': '동적',
  'edge.type': '타입',
  'expand.layout': '레이아웃이 이 라우트를 감쌉니다',
  'expand.template': '템플릿이 이 라우트를 감쌉니다',
  'expand.loading': 'loading 파일이 이 라우트에 적용됩니다',
  'expand.error': 'error 파일이 이 라우트에 적용됩니다',
  'expand.not-found': 'not-found 파일이 이 라우트에 적용됩니다',
  'expand.default': '병렬 슬롯의 default 가 이 라우트에 적용됩니다',
  'expand.global-error': 'global-error 는 모든 페이지에 적용됩니다',
  'expand._app': '_app 이 모든 Pages Router 페이지를 감쌉니다',
  'expand._document': '_document 가 모든 Pages Router 페이지를 감쌉니다',
  'expand.proxy': 'proxy matcher 가 이 라우트를 포함합니다',
  'expand.middleware': 'middleware matcher 가 이 라우트를 포함합니다',
  'intercept.label': '가로채기',

  'summary.routes': '바뀐 파일 {files}개가 라우트 {count}개에 닿습니다',
  'summary.none': '바뀐 파일 {files}개가 닿는 라우트가 없습니다.',
  'section.removed': '삭제된 라우트',
  'section.uncertain': '불확실 (직접 확인 필요)',
  'section.unresolved': '해석하지 못한 import',
  'section.parseErrors': '파싱하지 못한 파일',
  'section.notes': '참고',
  'reason.outside-graph': 'import 그래프 밖의 파일입니다 (자산·설정·스크립트)',
  'reason.deleted': '삭제되어 이 파일을 쓰던 곳을 추적할 수 없습니다',
  'reason.matcher-not-static': 'matcher 가 정적 값이 아니라 모든 라우트가 해당한다고 가정했습니다',
  'reason.matcher-unsupported': 'matcher 문법을 지원하지 않아 모든 라우트가 해당한다고 가정했습니다',
  'unresolved.non-literal-dynamic-import': '경로를 계산하는 동적 import',
  'unresolved.not-found': 'import 경로를 찾지 못함',
  'parse.errors': '문법 오류 {count}개',
  'note.middleware-renamed': '{file} 은(는) 예전 이름(middleware)을 씁니다. Next.js 16 에서 proxy.ts 로 이름이 바뀌었습니다.',

  'tests.heading': '테스트 선택',
  'tests.runAll': '전체 테스트를 돌리세요. 이유: {files}',
  'tests.files': '선택된 테스트 파일',
  'tests.unmapped': '테스트 매핑이 없는 라우트',
  'tests.none': '선택된 테스트 파일이 없습니다.',
  'tests.runAllStderr': '전체 테스트를 돌리세요: {files} 이(가) 바뀌었습니다 (설정의 runAllOn 참고).',

  'md.heading': '라우트 영향',
  'md.table.url': 'URL',
  'md.table.kind': '종류',
  'md.table.changed': '바뀐 파일',
  'md.noRoutes': '영향받는 라우트가 없습니다.',
  'md.detailsSummary': '이 라우트들이 영향받는 이유',
  'fail.uncertain': '불확실하거나 해석 못 한 항목 {count}개: 종료 코드 3 으로 끝냅니다 (--fail-on-uncertain).',
};
