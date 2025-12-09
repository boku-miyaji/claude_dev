# DevContainer設定

このディレクトリには、開発環境用のdevcontainer設定が含まれています。

## GPU設定の切り替え

GPUあり/なしを切り替えて使用できます。

### 設定ファイルとDockerfile

2つの設定ファイルと2つのDockerfileが用意されています：

#### CPU版
- 設定ファイル: `devcontainer-cpu.json`
- Dockerfile: `Dockerfile-cpu` (node:20ベース)
- GPU設定なしで動作します
- CPU環境で使用する場合に推奨

#### GPU版
- 設定ファイル: `devcontainer-gpu.json`
- Dockerfile: `Dockerfile-gpu` (NVIDIA CUDA/cuDNNベース)
- GPUを使用する場合に使用します
- NVIDIA GPUとNVIDIA Container Toolkitが必要
- cuDNNライブラリが含まれています

**切り替え方法:**

1. **VSCode/Cursorで直接開く方法（推奨）:**
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

### GPU版を使用する場合

1. **ホストマシンにNVIDIA GPUが必要**
   - NVIDIA GPUドライバがインストールされていること
   - `nvidia-smi` コマンドが動作すること

2. **NVIDIA Container Toolkitが必要**
   - DockerでGPUを使用するために必要
   - インストール方法: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

3. **PaddlePaddle GPU版のインストール**
   - コンテナ起動後、以下のコマンドでGPU版をインストール:
   ```bash
   cd /workspace/paddleocr
   source venv/bin/activate
   pip uninstall paddlepaddle -y
   pip install paddlepaddle-gpu
   ```

### CPU版を使用する場合

- 特別な設定は不要です
- `devcontainer-cpu.json` を使用してください
- `Dockerfile-cpu` が自動的に使用されます（node:20ベース）

## 確認方法

### GPUが利用可能か確認

```bash
# コンテナ内で実行
nvidia-smi

# PaddlePaddleでGPUが認識されているか確認
python3 -c "import paddle; print('GPU available:', paddle.device.is_compiled_with_cuda()); print('GPU count:', paddle.device.cuda.device_count() if paddle.device.is_compiled_with_cuda() else 0)"
```

## トラブルシューティング

### GPUが認識されない場合

1. ホストマシンで `nvidia-smi` が動作するか確認
2. NVIDIA Container Toolkitがインストールされているか確認
3. DockerでGPUが使用可能か確認: `docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi`
4. コンテナを再起動

### PaddlePaddleがGPUを認識しない場合

1. PaddlePaddle GPU版がインストールされているか確認
2. CUDAバージョンがPaddlePaddleの要件を満たしているか確認
3. 必要に応じて、特定のCUDAバージョン用のPaddlePaddleをインストール

