import os
os.environ["ML_SERVICE_KEY"] = "test-key"
import numpy as np
from fastapi.testclient import TestClient
from main import app

c = TestClient(app)
rng = np.random.default_rng(1)
rows = [{"pct": float(v), "delta": float(d), "label": 0} for v, d in zip(rng.normal(60, 5, 95), rng.normal(0, 1, 95))]
rows += [{"pct": 99.0, "delta": 15.0, "label": 1}, {"pct": 2.0, "delta": -14.0, "label": 1}, {"pct": 98.0, "delta": 12.0, "label": 1},
         {"pct": 5.0, "delta": -13.0, "label": 1}, {"pct": 97.0, "delta": 14.0, "label": 1}]


def test_rejects_missing_key():
    assert c.post("/detect", json={"rows": rows, "features": ["pct"]}).status_code == 401


def test_flags_injected_outliers_with_labels():
    r = c.post("/detect", headers={"X-ML-Key": "test-key"},
               json={"rows": rows, "features": ["pct", "delta"], "contamination": 0.05, "label_column": "label"}).json()
    flagged = {x["index"] for x in r["results"] if x["is_anomaly"]}
    assert {95, 96, 97, 98, 99} <= flagged
    assert r["metrics"]["recall"] == 1.0
    assert r["metrics"]["mode"] == "supervised_validation"
