# 授業用Supabaseセットアップ

これは10人パイロットのSupabaseとは別プロジェクト専用です。授業用プロジェクトができるまでは、このサイトの接続設定を有効にしないでください。

## 授業用プロジェクトができた後

1. Supabaseで新しい授業用プロジェクトを作成する。DBパスワードは手元で保管し、Gitやチャットに貼らない。
2. このフォルダでSupabase CLIを新プロジェクトにlinkし、`supabase db push --remote --dry-run` の対象が授業用プロジェクトであることを確認してから `db push` する。
3. `CLASSROOM_CODE_PEPPER` を新プロジェクトのEdge Function secretに設定する。値はランダムな32文字以上の秘密値。リポジトリには置かない。
4. `supabase functions deploy classroom-data` を実行する。
5. `classroom/classroom-data-config.js` に授業用Project URLとPublishable keyを記入する。Secret/service-role keyは絶対に書かない。
6. `scripts/generate_classroom_codes.py --count 114` を実行する。生成された参加コードCSVは管理者だけが保管し、出席番号との対応をそのCSV内で記入する。Hash seed SQLは一度だけ授業用DBで実行する。
7. `/classroom/pretest/` で事前アンケートと2セットの事前テストを収集する。
8. `queries/randomization_input.sql` の結果をCSVで保存し、`scripts/randomize_classroom.py --input <CSV>` を実行する。既定は114人完全データを要求する。割付SQLを確認し、授業用DBへ一度だけ適用する。
9. `/classroom/a/`〜`/classroom/d/` と `/classroom/posttest/` を少人数で確認してから生徒へ案内する。

事前アンケートは音楽経験段階、主な楽器、整数年の楽器経験、吹奏楽部所属の有無、他の音感トレーニングアプリ経験、絶対音感・相対音感の自己評価で構成する。加えて、ド→ファ、ド→ミ♭、ド→ソの音程名を問う4択を3問行い、各問の選択肢と正誤を `baseline_knowledge_answers` に保存する。この小テストは音を聴き分けるテストではなく、音楽理論の事前知識を測る。

この段階では新プロジェクトが未作成なので、migration・function・画面はローカルに準備した状態であり、本番SupabaseやGitHub Pagesにはまだ適用していません。
