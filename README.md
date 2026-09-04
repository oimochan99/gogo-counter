# gogo-counter

## CSS のビルド（Tailwind）

Tailwind は CDN ではなく、ビルド済みの `assets/tailwind.css` を各ページから読み込んでいます。
HTML や `tool/assets/*.js` で **Tailwind のクラスを追加・変更したら**、必ず再ビルドして生成された CSS もコミットしてください（GitHub Pages はビルドを実行しません）。

```bash
npm install        # 初回のみ
npm run build      # src/input.css → assets/tailwind.css
```

- 設定: `tailwind.config.js`（旧 CDN 版のインライン設定を移植。色・spacing はここで管理）
- 対象ファイル: `tailwind.config.js` の `content`（`*.html`, `tool/*.html`, `tool/assets/*.js`）
- 開発中に自動で再ビルドしたい場合: `npm run watch`

補足（変更するときの注意）:
- `--minify` は使っていません。Tailwind 3.4 の minify は半透明色（`text-on-surface-variant/50` など）を 1/255 ずらすため、CDN 版と同じ見た目を保つ目的で非圧縮のまま出力しています（gzip 後は約 9KB）。
- `@tailwindcss/forms` は CDN が同梱していた 0.5.9 に固定しています。0.5.11 以降はセレクタが `:where()` になり詳細度が変わるため、上げるときは見た目を再確認してください。
- GitHub Pages は CSS を 10 分キャッシュ（max-age=600）します。再ビルド直後の数分間は、古い CSS のまま新しい HTML が表示されることがあります（10 分で解消）。
