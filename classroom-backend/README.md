# 授業用Supabaseセットアップ

これは10人パイロットのSupabaseとは別プロジェクト専用です。授業用Supabaseは `pitch-classroom-study`（ref: `kuhsictdijmhbyupnyza`、東京リージョン）として作成し、初期DB migration と再試行用migrationを適用し、`classroom-data` function をデプロイ済みです。旧 `anon` / `service_role` APIキーは無効化済みです。授業用コード114件をDBに登録しました。群割付は事前アンケート・事前テスト後に行います。

## 授業用プロジェクトができた後

1. 完了: 新しい授業用プロジェクトを東京リージョンに作成。DBパスワードは `~/.supabase/classroom-db-password` に保存し、Gitやチャットに貼らない。
2. 完了: migrationをdry-runで確認後、授業用プロジェクトに適用。
3. 完了: `CLASSROOM_CODE_PEPPER` をEdge Function secretに設定。値はリポジトリに置かない。
4. 完了: `classroom-data` functionをデプロイ。
5. 完了: `classroom/classroom-data-config.js` に授業用Project URLとPublishable keyを設定。Secret/service-role keyは絶対に書かない。
6. 完了: 擬似席番号と参加コードの対応表を管理者専用の `~/.supabase/classroom_codes_private.csv` に保存。クラス人数は21・23・24・24・22人。生徒に配るコードはこのファイルから渡し、ファイルをGitHubや共有チャットへ置かない。
7. Pages公開後、`/classroom/pretest/` でアンケートと2セットの事前テストを収集する。事前テスト完了まではA〜D群の練習ページと事後テストは開始できない。
8. 事前データが揃ったら `queries/randomization_input.sql` の結果をCSVで保存し、`scripts/randomize_classroom.py --input <CSV>` を実行する。割付表を確認し、生成された割付SQLを授業用DBへ適用する。
9. 群割付後に `/classroom/a/`〜`/classroom/d/` の対応する群ページと `/classroom/posttest/` を利用する。

事前テスト前のアンケートは事前テストページだけに表示する。音楽活動期間は5区分で記録し、分析用の3段階は保存時に導出する。楽器経験は「経験なし」「連続的に音高を調節する楽器（トロンボーン・バイオリンなど）」「段階的に音を選ぶ楽器（ピアノ・フルートなど）」「音高を主に扱わない打楽器（ドラムなど）」「その他」の5区分で尋ねる。音程知識クイズは「わからない」を含む5問とする。回答は参加者単位の `participant_baseline_v3` と `participant_knowledge_answers_v3` に保存する。音程知識を先に尋ねると聴き取り方に影響する可能性があるため、その点を研究の限界として扱う。楽器プロフィール別の比較は、各分類の人数が少ない間は探索的な結果として扱う。A〜D群ページにはこの事前アンケートを表示せず、各回の出力方法（スピーカー・イヤホン）のみ選択する。

授業用DB、二つのmigration、Edge Function、114件のコードハッシュ登録は完了しています。コードと擬似席番号の対応表はローカルの管理者専用ファイルにあります。GitHub Pages公開後にURL応答とSupabase接続を確認してください。生徒への配布は、事前データ収集と群割付の流れを先生と確認してから行ってください。

## 回線が切れたとき

- 回答ごとに送信し、通信に失敗した回答は同じブラウザーの `localStorage` に一時保存して、後から再送する。
- 未送信回答が残っている間はセッションを完了扱いにしない。全10問がDBに届いてから完了時刻を付ける。
- 未完了の事前テストは削除せず残す。完了した事前テストだけを2セット上限に数えるため、途中離脱のあとも新しい試行を開始できる。
- 再送するまでは、ブラウザーのサイトデータを消さず、同じ端末・同じ研究参加コードを使う。
