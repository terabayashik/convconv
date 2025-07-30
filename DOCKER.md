# Docker Setup

## 概要

このプロジェクトは単一のDockerコンテナーで動作し、フロントエンドとバックエンドの両方を提供します。

## 特徴

- Bunベースイメージ（Debian）使用
- FFmpeg組み込み
- マルチステージビルドによる最適化
- フロントエンドの静的ファイルはバックエンドから配信
- ヘルスチェック機能付き

## 使用方法

### Docker Composeを使用する場合（推奨）

Dockerfileはマルチステージビルドを使用しており、フロントエンドのビルドとバックエンドの実行を分離しています。

**注意**: ViteはビルドにRollupを使用しており、Rollupにはプラットフォーム固有のネイティブバインディングがあります。このため、ARM64アーキテクチャ（Apple Siliconなど）でのビルドエラーを回避するため、フロントエンドビルドステージではNode.jsをインストールしています。依存関係の管理にはBunを使用し、ビルドの実行にはNode.jsを使用するハイブリッドアプローチを採用しています。

```bash
# ビルドと起動
docker-compose up -d --build

# または既にビルド済みの場合は起動のみ
docker-compose up -d
```

#### 共通操作

```bash
# カスタム設定ファイルを指定して起動
docker-compose run -d \
  -p 3000:3000 \
  -v $(pwd)/config.json:/app/backend/config.json \
  convconv

# ログ確認
docker-compose logs -f

# 停止
docker-compose down
```

### Dockerコマンドを直接使用する場合

```bash
# イメージのビルド（マルチステージビルドでフロントエンドも含む）
docker build -t convconv .

# コンテナーの起動
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/backend/uploads \
  --name convconv \
  convconv

# カスタム設定ファイルを指定して起動
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/backend/uploads \
  -v $(pwd)/config.json:/app/backend/config.json \
  --name convconv \
  convconv

# ログ確認
docker logs -f convconv

# 停止と削除
docker stop convconv
docker rm convconv
```

## 環境変数

- `NODE_ENV`: 実行環境（デフォルト: production）
- `PORT`: サーバーポート（デフォルト: 3000）

## ボリューム

- `/app/backend/uploads`: アップロードファイルの永続化

## アクセス

- http://localhost:3000 - フロントエンド
- http://localhost:3000/api - APIエンドポイント
- ws://localhost:3000/ws - WebSocketエンドポイント

## カスタム設定

### 方法1: docker-compose.ymlを編集

`docker-compose.yml`の該当行をアンコメント：

```yaml
volumes:
  - ./uploads:/app/backend/uploads
  - ./config.json:/app/backend/config.json  # この行のコメントを外す
```

### 方法2: コマンドラインで指定

上記の「使用方法」セクションに記載されているコマンドラインオプションを使用してください。