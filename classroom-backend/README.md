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

事前テスト前は、音楽活動期間を5区分、最も経験の長い楽器系統、吹奏楽部経験、他の音感アプリ経験、絶対音感の自己評価を尋ねる。3段階の経験区分は保存時に導出する。ピアノなど段階的に音を選ぶ楽器、トロンボーンなど連続的に音高を調整する楽器、音高を主に扱わない打楽器を、系統と音高操作プロフィールの両方で記録する。事前テストの前に、相対音感の自己評価（1〜5）と、各問に「わからない」を含む音程知識3問も尋ねる。回答は参加者単位の `participant_baseline_v3` と `participant_knowledge_answers_v3` に保存する。音程知識を先に尋ねると聴き取り方に影響する可能性があるため、その点を研究の限界として扱う。楽器プロフィール別の比較は、各分類の人数が少ない間は探索的な結果として扱う。

この段階では新プロジェクトが未作成なので、migration・function・画面はローカルに準備した状態であり、本番SupabaseやGitHub Pagesにはまだ適用していません。
