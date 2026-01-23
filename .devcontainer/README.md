# DevContainer 設定

このディレクトリには、開発環境用の devcontainer 設定が含まれています。

## GPU 設定の切り替え

GPU あり/なしを切り替えて使用できます。

### 設定ファイルと Dockerfile

2 つの設定ファイルと 2 つの Dockerfile が用意されています：

#### CPU 版

- 設定ファイル: `devcontainer-cpu.json`
- Dockerfile: `Dockerfile-cpu` (node:20 ベース)
- GPU 設定なしで動作します
- CPU 環境で使用する場合に推奨

#### GPU 版

- 設定ファイル: `devcontainer-gpu.json`
- Dockerfile: `Dockerfile-gpu` (NVIDIA CUDA/cuDNN ベース)
- GPU を使用する場合に使用します
- NVIDIA GPU と NVIDIA Container Toolkit が必要
- cuDNN ライブラリが含まれています

**切り替え方法:**

1. **VSCode/Cursor で直接開く方法（推奨）:**

   - `.devcontainer/devcontainer-cpu.json` または `.devcontainer/devcontainer-gpu.json` を開く
   - コマンドパレット（Cmd/Ctrl+Shift+P）を開く
   - "Dev Containers: Reopen in Container" を選択
   - または、`.devcontainer/devcontainer-cpu.json` または `.devcontainer/devcontainer-gpu.json` を `devcontainer.json` にコピーして使用

2. **ファイルをリネームする方法:**

   ```bash
   cd .devcontainer
   # CPU版を使用する場合
   cp devcontainer-cpu.json devcontainer.json

   # GPU版を使用する場合
   cp devcontainer-gpu.json devcontainer.json
   ```

## 前提条件

### GPU 版を使用する場合

1. **ホストマシンに NVIDIA GPU が必要**

   - NVIDIA GPU ドライバがインストールされていること
   - `nvidia-smi` コマンドが動作すること

2. **NVIDIA Container Toolkit が必要**

   - Docker で GPU を使用するために必要
   - インストール方法: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

3. **PaddlePaddle GPU 版のインストール**
   - コンテナ起動後、以下のコマンドで GPU 版をインストール:
   ```bash
   cd /workspace/paddleocr
   source venv/bin/activate
   pip uninstall paddlepaddle -y
   pip install paddlepaddle-gpu
   ```

### CPU 版を使用する場合

- 特別な設定は不要です
- `devcontainer-cpu.json` を使用してください
- `Dockerfile-cpu` が自動的に使用されます（node:20 ベース）

## 確認方法

### GPU が利用可能か確認

```bash
# コンテナ内で実行
nvidia-smi

# PaddlePaddleでGPUが認識されているか確認
python3 -c "import paddle; print('GPU available:', paddle.device.is_compiled_with_cuda()); print('GPU count:', paddle.device.cuda.device_count() if paddle.device.is_compiled_with_cuda() else 0)"
```

## トラブルシューティング

### GPU が認識されない場合

1. ホストマシンで `nvidia-smi` が動作するか確認
2. NVIDIA Container Toolkit がインストールされているか確認
3. Docker で GPU が使用可能か確認: `docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi`
4. コンテナを再起動

### PaddlePaddle が GPU を認識しない場合

1. PaddlePaddle GPU 版がインストールされているか確認
2. CUDA バージョンが PaddlePaddle の要件を満たしているか確認
3. 必要に応じて、特定の CUDA バージョン用の PaddlePaddle をインストール
