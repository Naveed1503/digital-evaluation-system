"""Zero-shot rubric-based LLM scoring on a stratified sample of the hold-out split.
Same model and prompt style as the in-app 'AI suggested mark' feature.
Needs LOVABLE_API_KEY and outputs/test_split_ids.json (from experiment.py)."""
import json, os, time, concurrent.futures as cf
import pandas as pd, requests
from sklearn.model_selection import train_test_split

MODEL = "openai/gpt-6-astra"
URL = "https://ai.gateway.lovable.dev/v1/responses"
KEY = os.environ["LOVABLE_API_KEY"]
PER_SET = int(os.environ.get("PER_SET", "20"))
OUT = "outputs/llm_predictions.csv"

df = pd.concat([pd.read_csv("data/train.csv"), pd.read_csv("data/validation.csv")])
ids = json.load(open("outputs/test_split_ids.json"))
sample = pd.concat([train_test_split(g := df[df.Id.isin(lst)], train_size=PER_SET, stratify=g.Score1, random_state=42)[0] for lst in ids.values()])
done = pd.read_csv(OUT) if os.path.exists(OUT) else pd.DataFrame(columns=["Id"])
todo = sample[~sample.Id.isin(done.Id)]
print(f"{len(done)} cached, {len(todo)} to score", flush=True)

SYSTEM = ("You are an experienced examiner. Score the student's answer strictly according to the question and rubric. "
          "Return only the integer score and a one-sentence justification.")

def score(row):
    mx = 3 if row.essay_set in (1, 2, 5, 6, 10) else 2
    body = {
        "model": MODEL, "stream": True, "store": False, "reasoning": {"effort": "low"}, "instructions": SYSTEM,
        "input": f"QUESTION AND RUBRIC:\n{row.prompt}\n\nMAXIMUM SCORE: {mx}\n\nSTUDENT ANSWER:\n{row.essay_text}",
        "text": {"format": {"type": "json_schema", "name": "score", "strict": True, "schema": {
            "type": "object", "additionalProperties": False, "required": ["score", "reason"],
            "properties": {"score": {"type": "integer"}, "reason": {"type": "string"}}}}},
    }
    for attempt in range(4):
        r = requests.post(URL, json=body, stream=True, timeout=180, headers={
            "Lovable-API-Key": KEY, "Authorization": f"Bearer {KEY}", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json"})
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(3 * 2 ** attempt); continue
        if r.status_code != 200:
            raise RuntimeError(f"{r.status_code} {r.text[:300]}")
        text = ""
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data:"):
                d = line[5:].strip()
                if d == "[DONE]": break
                ev = json.loads(d)
                if ev.get("type") == "response.output_text.delta": text += ev.get("delta", "")
        out = json.loads(text)
        return dict(Id=int(row.Id), set=int(row.essay_set), y=int(row.Score1), p=max(0, min(mx, int(out["score"]))), reason=out["reason"])
    raise RuntimeError("retries exhausted")

results = []
with cf.ThreadPoolExecutor(6) as ex:
    for i, res in enumerate(ex.map(score, [r for _, r in todo.iterrows()])):
        results.append(res)
        if i % 20 == 19:  # checkpoint so a restart never loses paid work
            pd.concat([done, pd.DataFrame(results)]).to_csv(OUT, index=False)
pd.concat([done, pd.DataFrame(results)]).to_csv(OUT, index=False)
print("done", len(done) + len(results))
