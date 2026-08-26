#!/usr/bin/env bash
# ============================================================
# 语音输入插件 · 环境安装脚本（Linux / macOS）
# 用法：
#   bash setup.sh                                    # 默认（PyPI 官方源）
#   bash setup.sh -m https://pypi.tuna.tsinghua.edu.cn/simple
#   bash setup.sh --skip-models                      # 跳过 FunASR 模型预下载
# 作用：
#   ① 创建 .venv（若不存在）
#   ② pip 安装 requirements.txt（faster-whisper + FunASR ONNX + onnxruntime，无 torch）
#   ③ 预下载 FunASR 中文模型（paraformer-zh + vad + punc，约 0.9GB，ModelScope）
#   ④ 打印后续配置提示（DSH_VOICE_ROOT / 海外镜像）
# 注意：对应 Windows 版为 setup.ps1；插件部署步骤见 DISTRIBUTION.md
# ============================================================
set -euo pipefail

MIRROR=""
SKIP_MODELS=0

usage() {
  echo "用法：bash setup.sh [-m <pip镜像URL>] [--skip-models]"
  echo "  -m, --mirror <URL>    pip 镜像（如 https://pypi.tuna.tsinghua.edu.cn/simple）"
  echo "      --skip-models     跳过 FunASR 模型预下载（首次识别时自动下载）"
  echo "  -h, --help            显示帮助"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--mirror) MIRROR="${2:-}"; shift 2 ;;
    --skip-models) SKIP_MODELS=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
PY="$ROOT/.venv/bin/python"
REQ="$SCRIPT_DIR/requirements.txt"

echo "==> 仓库根: $ROOT"

# 1) venv
if [[ ! -x "$PY" ]]; then
  echo "==> 创建虚拟环境 .venv ..."
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv "$ROOT/.venv"
  else
    echo "错误：未找到 python3，请先安装 Python 3.9+（macOS: brew install python3）"
    exit 1
  fi
  [[ -x "$PY" ]] || { echo "错误：venv 创建失败"; exit 1; }
else
  echo "==> 虚拟环境已存在"
fi

# 2) pip 依赖（缓存固定在工作区 .pip-cache）
CACHE_DIR="$ROOT/.pip-cache"
mkdir -p "$CACHE_DIR"
PIP_ARGS=(install --disable-pip-version-check --cache-dir "$CACHE_DIR" --upgrade -r "$REQ")
if [[ -n "$MIRROR" ]]; then
  PIP_ARGS+=(-i "$MIRROR")
fi
echo "==> 安装依赖: ${PIP_ARGS[*]}"
"$PY" -m pip "${PIP_ARGS[@]}"

# 3) FunASR 模型预下载（asr + vad + punc 三个模型）
if [[ "$SKIP_MODELS" -eq 0 ]]; then
  echo "==> 预下载 FunASR 模型（paraformer-zh + vad + punc，约 0.9GB，首次较慢）"
  DSH_VOICE_ROOT="$ROOT" "$PY" "$ROOT/.voice-asr/transcribe.py" --download paraformer-zh
  echo "==> 模型就绪"
fi

# 4) 提示
cat <<EOF

==> 安装完成 ✅
  本地 faster-whisper：模型缓存于 <仓库根>/.hf
  FunASR：模型缓存在 <仓库根>/.modelscope
  部署到 dsh：见 DISTRIBUTION.md（Linux/macOS 手动部署步骤）

  若插件部署在非本仓库路径，请设置环境变量后重启 dsh：
    export DSH_VOICE_ROOT="$ROOT"

  海外网络：模型下载慢/失败时设置
    export DSH_HF_ENDPOINT=https://huggingface.co
EOF
