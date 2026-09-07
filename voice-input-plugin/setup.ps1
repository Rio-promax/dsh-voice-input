# ============================================================
# 语音输入插件 · 环境安装脚本（Windows）
# 用法：
#   pwsh -File setup.ps1                 # 仅安装 Python 依赖，不下载大模型
#   pwsh -File setup.ps1 -WithModels     # 额外下载 FunASR ASR + VAD 模型
#   pwsh -File setup.ps1 -WithModels -ModelRoot E:\DSH\models
#   pwsh -File setup.ps1 -WithPunctuation # 下载模型并额外下载标点模型（较大）
# 作用：
#   ① 创建 .venv（若不存在）
#   ② pip 安装 requirements.txt（faster-whisper + FunASR ONNX + onnxruntime）
#   ③ 可选：预下载 FunASR 中文模型（默认不下载；-WithModels 开启）
#   ④ 打印后续配置提示（DSH_VOICE_ROOT / DSH_VOICE_PYTHON）
# 注意：本文件必须 UTF-8 带 BOM 保存（Windows PowerShell 5.1 按 ANSI/GBK 读取无 BOM 会乱码）
# ============================================================
param(
  [string]$Mirror = "",
  [string]$ModelRoot = "",
  [switch]$WithModels,
  [switch]$WithPunctuation,
  [switch]$SkipModels
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root '.venv\Scripts\python.exe'
$modelRoot = if ($ModelRoot) { [System.IO.Path]::GetFullPath($ModelRoot) } else { $root }

Write-Host "==> 工作区: $root"

# 1) venv
if (-not (Test-Path $py)) {
  Write-Host "==> 创建虚拟环境 .venv ..."
  python -m venv (Join-Path $root '.venv')
  if (-not (Test-Path $py)) { throw 'venv 创建失败：请确认已安装 Python 3.9+ 且在 PATH 中' }
} else {
  Write-Host "==> 虚拟环境已存在"
}

# 2) pip 依赖（缓存固定在工作区 .pip-cache，避免写入系统缓存目录被拒绝/污染）
$cacheDir = Join-Path $root '.pip-cache'
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
$pipArgs = @('-m', 'pip', 'install', '--disable-pip-version-check', '--cache-dir', $cacheDir, '--upgrade', '-r', (Join-Path $PSScriptRoot 'requirements.txt'))
if ($Mirror) { $pipArgs += @('-i', $Mirror) }
Write-Host "==> 安装依赖: $($pipArgs -join ' ')"
& $py @pipArgs
if ($LASTEXITCODE -ne 0) { throw 'pip 安装失败（网络问题可尝试 -Mirror 指定国内镜像）' }

# 3) FunASR 模型预下载（默认按需；-WithModels 才下载）
if ($WithPunctuation) { $WithModels = $true }
if ($WithModels -and -not $SkipModels) {
  $env:DSH_VOICE_ROOT = $root
  $env:DSH_MODEL_ROOT = $modelRoot
  $env:HF_HOME = Join-Path $modelRoot '.hf'
  $env:MODELSCOPE_CACHE = Join-Path $modelRoot '.modelscope'
  $env:MODELSCOPE_HOME = Join-Path $modelRoot '.modelscope-home'
  $asr = 'paraformer-zh'; $vad = 'fsmn-vad'
  $puncArg = if ($WithPunctuation) { "'ct-punc'" } else { 'None' }
  Write-Host "==> 预下载 FunASR 模型: $asr + $vad" + $(if ($WithPunctuation) { " + ct-punc" } else { "" }) + "（首次约 300MB-1GB，国内 ModelScope 较快）"
  $pyCode = @"
from funasr_onnx_automodel import AutoModel
AutoModel(model='$asr', vad_model='$vad', punc_model=$puncArg)
print('模型就绪')
"@
  $pyCode | & $py -
  if ($LASTEXITCODE -ne 0) { throw '模型下载失败：请检查网络（ModelScope 需可访问）' }
} else {
  Write-Host "==> 跳过模型下载（首次使用或设置中的「本地模型管理」可按需下载）"
}

# 4) 提示
Write-Host ""
Write-Host "==> 安装完成 ✅"
Write-Host "  本地 faster-whisper：缓存于 $modelRoot\.hf"
Write-Host "  FunASR：模型缓存于 $modelRoot\.modelscope"
Write-Host "  当前模型目录：$modelRoot（可在设置 → 本地模型管理中更改）"
Write-Host ""
Write-Host "  若插件部署在非本工作区路径，请设置环境变量后重启 DSH："
Write-Host "    DSH_VOICE_ROOT   = $root"
Write-Host "    DSH_VOICE_PYTHON = $py（可选，默认自动找 <root>\.venv 内解释器）"
Write-Host ""
Write-Host "  海外网络：设置 DSH_HF_ENDPOINT=https://huggingface.co 可换回 HF 官方源"
