# v51 chat 组装冒烟测试：mock httpx.post 捕获 payload，验证历史消息注入与同角色合并
import json
import os
import sys
from pathlib import Path
from unittest import mock

os.environ["DSH_DEEPSEEK_API_KEY"] = "fake-key-for-test"
os.environ["DSH_DEEPSEEK_BASE_URL"] = "http://127.0.0.1:1"
sys.path.insert(0, str(Path(__file__).resolve().parent))
import transcribe as t

captured = {}

def fake_post(url, json=None, headers=None, timeout=None):
    captured["messages"] = json["messages"]
    class R:
        status_code = 200
    r = R()
    r.json = lambda: {"choices": [{"message": {"content": "我们明天开会。"}}]}
    return r

with mock.patch("httpx.post", side_effect=fake_post):
    payload = {
        "text": "我们明天开会",
        "before": "",
        "after": "",
        "context": [
            {"role": "user", "content": "今天讨论项目进度"},
            {"role": "assistant", "content": "好的，我们来看一下"},
            {"role": "user", "content": "项目叫什么名字"},
            {"role": "assistant", "content": "叫张伟项目"},
            {"role": "user", "content": "好的"},
            {"role": "assistant", "content": "嗯嗯"},
            {"role": "user", "content": "第三个问题"},  # 第 7 条，应被丢弃（最多 6 条）
        ],
    }
    t.transcribe_chat(payload)

for i, m in enumerate(captured["messages"]):
    print(i, m["role"], "->", m["content"][:60])
