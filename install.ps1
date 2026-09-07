# ============================================================
# 语音输入插件 · 一键安装器（Windows）
# 用法：
#   pwsh -File install.ps1                                          # 自动定位 DSH profiles 并安装
#   pwsh -File install.ps1 -DshRoot C:\Users\me\.dsh                # 手动指定 DSH 配置目录
#   pwsh -File install.ps1 -SkipPython                              # 跳过 Python 依赖安装
#   pwsh -File install.ps1 -WithModels -ModelRoot E:\DSH\models      # 明确预下载模型到指定目录
#   pwsh -File install.ps1 -Mirror https://pypi.tuna.tsinghua.edu.cn/simple
# 作用：
#   ① 复制插件包到 <DSH>\profiles\node_modules\dsh-plugin-voice-input
#      （host.js → lib\index.js，client.js → lib\client.js，与 package.json exports 对齐）
#   ② 幂等注册组合行（cordis.patch.yml，自动备份，不覆盖其他插件内容）
#   ③ 调用 setup.ps1 安装 Python 依赖（-SkipPython 跳过）
#   ④ 提示重启 dsh 与语音组件根目录配置
# 注意：本文件必须 UTF-8 带 BOM 保存（Windows PowerShell 5.1 按 ANSI/GBK 读取无 BOM 会乱码）
# ============================================================
param(
  [string]$DshRoot = "",
  [switch]$SkipPython,
  [switch]$WithModels,
  [switch]$SkipModels,
  [string]$ModelRoot = "",
  [string]$Mirror = ""
)
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot                    # 仓库根（含 .voice-asr、voice-input-plugin）
$pkg = Join-Path $src 'voice-input-plugin'

Write-Host "==> 仓库根: $src"

# 0) 定位 DSH 配置目录（DSH_HOME 环境变量 > ~/.dsh；可用 -DshRoot 覆盖）
if (-not $DshRoot) {
  $DshRoot = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
}
$profiles = Join-Path $DshRoot 'profiles'
$dst = Join-Path $profiles 'node_modules\dsh-plugin-voice-input'
$patch = Join-Path $profiles 'web\cordis.patch.yml'
if (-not (Test-Path $profiles)) { throw "未找到 DSH profiles 目录：$profiles（请用 -DshRoot 指定，例如 -DshRoot C:\Users\你\.dsh）" }
Write-Host "==> DSH 配置目录: $DshRoot"

# 1) 复制插件包（真实拷贝，勿用 junction——Node 会把 junction 解析为真实路径导致依赖查找失败）
if (-not (Test-Path (Join-Path $pkg 'package.json'))) { throw "未找到插件包：$pkg（请确认 install.ps1 位于仓库根目录）" }
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'lib') | Out-Null
Copy-Item (Join-Path $pkg 'package.json') $dst -Force
Copy-Item (Join-Path $pkg 'host.js') (Join-Path $dst 'lib\index.js') -Force
Copy-Item (Join-Path $pkg 'client.js') (Join-Path $dst 'lib\client.js') -Force
Write-Host "==> 插件已复制: $dst"

# 2) 幂等注册组合行（只增改自己的 insert 区块，保留其他插件内容）
$insertBlock = @"

# Voice input plugin (installed by install.ps1).
- insert:
    - id: voice-input
      name: 'dsh-plugin-voice-input'
"@
$standalone = @"
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; ``!!js`` expressions allowed).

# Voice input plugin (installed by install.ps1).
- insert:
    - id: voice-input
      name: 'dsh-plugin-voice-input'
"@
if (Test-Path $patch) {
  $content = Get-Content $patch -Raw -Encoding UTF8
  if ($content -match 'dsh-plugin-voice-input') {
    Write-Host "==> 组合已注册: $patch（跳过）"
  } else {
    Copy-Item $patch "$patch.bak-$(Get-Date -Format yyyyMMdd-HHmmss)" -Force
    $trimmed = $content.Trim()
    if ($trimmed -eq '' -or $trimmed -eq '[]') {
      # 空占位符：整体替换为规范格式（此时无第三方内容，安全）
      Set-Content -Path $patch -Value $standalone -Encoding UTF8
    } else {
      # 共享文件：仅追加自己的 insert 区块
      Set-Content -Path $patch -Value ($content.TrimEnd() + $insertBlock + "`n") -Encoding UTF8
    }
    Write-Host "==> 组合已注册（原文件已备份为 .bak-*）"
  }
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $patch) | Out-Null
  Set-Content -Path $patch -Value $standalone -Encoding UTF8
  Write-Host "==> 组合已创建: $patch"
}

# 3) Python 依赖（可选跳过；模型默认不下载，-WithModels 才预下载）
if (-not $SkipPython) {
  $setupArgs = @()
  if ($Mirror) { $setupArgs += @('-Mirror', $Mirror) }
  if ($ModelRoot) { $setupArgs += @('-ModelRoot', $ModelRoot) }
  if ($WithModels -and -not $SkipModels) { $setupArgs += @('-WithModels') } else { $setupArgs += @('-SkipModels') }
  & (Join-Path $pkg 'setup.ps1') @setupArgs
  if ($LASTEXITCODE -ne 0) { throw 'Python 依赖安装失败（可 -SkipPython 跳过，之后手动运行 setup.ps1）' }
} else {
  Write-Host '==> 已跳过 Python 依赖安装（本地引擎不可用，需之后运行 setup.ps1）'
}

# 4) 完成提示
Write-Host ""
Write-Host "==> 安装完成 ✅  请重启 dsh（先停旧实例，再运行 npx @deepseek-ai/dsh web）"
Write-Host "    重启后输入栏右侧应出现 🎤 ⚙ 按钮"
Write-Host "    模型不会随本体自动下载；打开设置 → 本地模型管理后可选择保存目录并按需下载"
Write-Host ""
Write-Host "  语音组件根目录（含 .voice-asr 与 .venv）解析方式，二选一："
Write-Host "    A. 推荐：把 dsh 会话工作区设置为本仓库根目录：$src"
Write-Host "    B. 或设置环境变量后重启 dsh：setx DSH_VOICE_ROOT `"$src`""
Write-Host ""
Write-Host "  海外网络：模型下载慢/失败时设置 DSH_HF_ENDPOINT=https://huggingface.co（whisper）"
Write-Host "           或 MODELSCOPE_ENDPOINT（FunASR），详见根 README 与 DISTRIBUTION.md"
