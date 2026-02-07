# TODO_FLOW

![](https://github.com/yut0takagi/todo-app/blob/master/img/DEMO.png?raw=true)


ローカルで常に動かす前提の、Kanban + Calendar 融合型TODOアプリです。
データは `data.json` に保存され、ブラウザではなくローカルJSONを唯一の真実として扱います。

## セットアップ

1. Node.js 18+ を用意
2. 以下を実行（自動でブラウザが開きます）

```bash
npm run start:open
```

3. 手動で開く場合は `http://localhost:57891`

## ログイン時に自動起動（macOS）

1. `~/Library/LaunchAgents` に plist を配置

```bash
cp /Users/yutotakagi/Develop/todo-app/com.todoflow.plist ~/Library/LaunchAgents/
```

2. launchd に読み込み

```bash
launchctl load ~/Library/LaunchAgents/com.todoflow.plist
```

3. 停止したい場合

```bash
launchctl unload ~/Library/LaunchAgents/com.todoflow.plist
```

## 特徴

- GitHub Projects風のKanbanボード
- カレンダー連動（due dateで可視化）
- クリックで詳細パネル編集
- JSON永続化（`data.json`）
- Vanta.js HALO 背景

## ショートカット

- `n` 新規タスク
- `/` 検索フォーカス
- `⌘K` / `Ctrl+K` コマンドパレット

## データ構造

- `data.json`
  - `columns`: ボード列
  - `tasks`: タスク配列

## カスタマイズ

- `data.json` を直接編集しても反映されます
- `style.css` でテーマ調整可能
