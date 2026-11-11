# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

이 도구는 로컬에서 소스 파일을 읽는 정적 분석 CLI 입니다. 네트워크 포트를 열지 않고, 외부로 요청을 보내지 않으며, API 키가 필요 없습니다. git 은 인자 배열로만 호출하고 `--base` 값은 먼저 검증합니다. / This is a static-analysis CLI that reads source files locally. It opens no network port, makes no outbound requests and needs no API keys. It runs git with an argument array only and validates `--base` first.
