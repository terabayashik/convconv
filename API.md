# ConvConv API Documentation

ConvConvは、FFmpegを使用したメディアファイル変換サービスです。REST APIとWebSocketを通じて利用できます。

## Base URL

```
http://localhost:3000
```

## 認証

現在、認証は必要ありません。すべてのエンドポイントは公開されています。

## エンドポイント

### 1. ヘルスチェック

```http
GET /api/health
```

**レスポンス**
```json
{
  "status": "ok"
}
```

### 2. ファイルアップロード（2ステップ方式）

```http
POST /api/upload
Content-Type: multipart/form-data
```

**リクエスト**
- `file`: アップロードするファイル（必須）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "filePath": "uploads/1234567890-video.mp4"
  }
}
```

### 3. 変換リクエスト（2ステップ方式）

```http
POST /api/convert
Content-Type: application/json
```

**リクエスト**
```json
{
  "file": "uploads/1234567890-video.mp4",
  "outputFormat": "webm",
  "options": {
    "scale": "1280x720"
  }
}
```

**パラメータ**
- `file`: アップロードされたファイルパス（必須）
- `outputFormat`: 出力形式（必須）
  - 動画: `mp4`, `webm`, `avi`, `mov`, `mkv`
  - 音声: `mp3`, `aac`, `wav`, `flac`
- `options`: 変換オプション（任意）
  - `scale`: 解像度（例: "1920x1080", "1280x720"）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "jobId": "job-1234567890",
    "status": "pending"
  }
}
```

### 4. ワンステップ変換（推奨）

```http
POST /api/convert-direct
Content-Type: multipart/form-data
```

**リクエスト**
- `file`: アップロードするファイル（必須）
- `outputFormat`: 出力形式（必須）
- `options`: JSON文字列形式の変換オプション（任意）

**cURLの例**
```bash
curl -X POST http://localhost:3000/api/convert-direct \
  -F "file=@video.mp4" \
  -F "outputFormat=webm" \
  -F 'options={"scale":"1280x720"}'
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "jobId": "job-1234567890",
    "status": "pending"
  }
}
```

### 5. ジョブステータス確認

```http
GET /api/jobs/{jobId}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "jobId": "job-1234567890",
    "status": "processing",
    "progress": 45,
    "downloadUrl": null
  }
}
```

**ステータス値**
- `pending`: 処理待ち
- `processing`: 変換中
- `completed`: 完了
- `failed`: 失敗

### 6. ファイルダウンロード

```http
GET /api/download/{jobId}
```

**レスポンス**
- 成功時: 変換されたファイル（バイナリ）
- 失敗時: 404 Not Found

### 7. FFmpegコマンドプレビュー

```http
POST /api/preview
Content-Type: application/json
```

**リクエスト**
```json
{
  "file": "uploads/1234567890-video.mp4",
  "outputFormat": "webm",
  "options": {
    "scale": "1280x720"
  }
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "command": "ffmpeg -i \"uploads/1234567890-video.mp4\" -progress pipe:2 -y -vf scale=1280:720 -c:v libvpx-vp9 -c:a libopus \"outputs/1234567890-video.webm\""
  }
}
```

## WebSocket（リアルタイム進捗）

```
ws://localhost:3000/ws
```

### 接続と購読

1. WebSocket接続を確立
2. ジョブIDを指定して購読

**購読メッセージ**
```json
{
  "type": "subscribe",
  "jobId": "job-1234567890"
}
```

**購読確認**
```json
{
  "type": "subscribed",
  "jobId": "job-1234567890"
}
```

### 進捗メッセージ

**進捗更新**
```json
{
  "type": "progress",
  "jobId": "job-1234567890",
  "data": {
    "percent": 45,
    "time": "00:01:23",
    "bitrate": "2048k",
    "speed": "1.2x"
  }
}
```

**完了**
```json
{
  "type": "complete",
  "jobId": "job-1234567890",
  "data": {
    "downloadUrl": "/api/download/job-1234567890"
  }
}
```

**エラー**
```json
{
  "type": "error",
  "jobId": "job-1234567890",
  "data": {
    "error": "FFmpeg exited with code 1"
  }
}
```

## 使用例

### Python
```python
import requests
import json

# ワンステップ変換
with open('video.mp4', 'rb') as f:
    response = requests.post(
        'http://localhost:3000/api/convert-direct',
        files={'file': f},
        data={
            'outputFormat': 'webm',
            'options': json.dumps({'scale': '1280x720'})
        }
    )
    
job = response.json()
job_id = job['data']['jobId']

# ステータス確認
status = requests.get(f'http://localhost:3000/api/jobs/{job_id}').json()
print(f"Status: {status['data']['status']}, Progress: {status['data']['progress']}%")

# ダウンロード（完了後）
if status['data']['status'] == 'completed':
    response = requests.get(f'http://localhost:3000/api/download/{job_id}')
    with open('output.webm', 'wb') as f:
        f.write(response.content)
```

### Node.js (with WebSocket)
```javascript
const WebSocket = require('ws');
const FormData = require('form-data');
const fs = require('fs');

// ファイルアップロードと変換
const form = new FormData();
form.append('file', fs.createReadStream('video.mp4'));
form.append('outputFormat', 'webm');
form.append('options', JSON.stringify({ scale: '1280x720' }));

const response = await fetch('http://localhost:3000/api/convert-direct', {
  method: 'POST',
  body: form
});

const { data } = await response.json();
const jobId = data.jobId;

// WebSocketで進捗監視
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', jobId }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'progress':
      console.log(`Progress: ${message.data.percent}%`);
      break;
    case 'complete':
      console.log('Conversion completed!');
      console.log(`Download URL: ${message.data.downloadUrl}`);
      ws.close();
      break;
    case 'error':
      console.error('Conversion failed:', message.data.error);
      ws.close();
      break;
  }
});
```

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

**HTTPステータスコード**
- `200`: 成功
- `400`: 不正なリクエスト
- `404`: リソースが見つからない
- `500`: サーバーエラー

## 制限事項

- 最大ファイルサイズ: 5GB
- 同時変換数: 制限なし（サーバーリソースに依存）
- ファイル保持期間: 設定可能（デフォルト24時間）