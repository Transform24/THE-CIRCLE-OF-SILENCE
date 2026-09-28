import json
import os
import urllib.request

GH_TOKEN = os.environ["GH_TOKEN"]
REPO = os.environ["REPO"]
RUN_ID = os.environ["RUN_ID"]

try:
    with open("/tmp/report.txt") as f:
        report = f.read()
except FileNotFoundError as e:
    report = "(no report.txt produced: {})".format(e)

body = "Run: {}\n\n```\n{}\n```\n".format(RUN_ID, report[:60000])


def api(method, path, data=None):
    url = "https://api.github.com{}".format(path)
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", "Bearer {}".format(GH_TOKEN))
    req.add_header("Accept", "application/vnd.github+json")
    body_bytes = None
    if data is not None:
        body_bytes = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=body_bytes) as resp:
        raw = resp.read()
        return json.loads(raw) if raw.strip() else {}


created = api("POST", "/repos/{}/issues".format(REPO), {
    "title": "TWWP Manual Ops log — run {}".format(RUN_ID),
    "body": body,
})
print("Created issue #{}: {}".format(created["number"], created["html_url"]))
