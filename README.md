# Pixel Ball Dodge — Cloudflare Workers Static Assets

정적 사이트 파일은 `assets/` 폴더에 있으며, `wrangler.jsonc`에서 Workers Static Assets 디렉터리로 지정되어 있습니다.

## 배포

저장소 루트에서 Wrangler로 배포합니다.

```sh
npx wrangler deploy
```

Cloudflare 인증이 된 환경에서 이 명령을 실행하면 설정된 Worker와 정적 자산이 배포됩니다. 기존 `exit 0`은 아무 작업도 하지 않는 명령이므로 Worker 자산을 업로드하지 않습니다.

## 폴더 구성

- `assets/index.html`: 사이트 시작 페이지
- `assets/style.css`: 스타일
- `assets/game.js`: 게임 코드
- `wrangler.jsonc`: Workers Static Assets 설정
