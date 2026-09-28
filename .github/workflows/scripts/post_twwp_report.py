import json
import os
import subprocess
import sys

GH_TOKEN = os.environ["GH_TOKEN"]
REPO = os.environ["REPO"]
RUN_ID = os.environ["RUN_ID"]

try:
    with open("/tmp/report.txt") as f:
        report = f.read()
except FileNotFoundError:
    report = "(no report.txt produced)"

body = "### TWWP Manual Ops run\n\nRun: {}\n\n```\n{}\n```\n".format(RUN_ID, report[:60000])


def api(method, path, data=None):
    url = "https://api.github.com{}".format(path)
    cmd = [
        "curl", "-sS", "-X", method,
        "-H", "Authorization: Bearer {}".format(GH_TOKEN),
        "-H", "Accept: application/vnd.github+json",
        "-H", "Content-Type: application/json",
        url,
    ]
    if data is not None:
        cmd += ["-d", json.dumps(data)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(out.stdout) if out.stdout.strip() else {}


issues = api("GET", "/repos/{}/issues?state=open&labels=twwp-ops&per_page=1".format(REPO))
if issues:
    issue_num = issues[0]["number"]
else:
    created = api("POST", "/repos/{}/issues".format(REPO), {
        "title": "TWWP Manual Ops log",
        "body": "Automated log issue for twwp-manual-ops.yml runs.",
        "labels": ["twwp-ops"],
    })
    issue_num = created["number"]

api("POST", "/repos/{}/issues/{}/comments".format(REPO, issue_num), {"body": body})
print("Posted report to issue #{}".format(issue_num))
