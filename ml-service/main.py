"""Intelligent Evaluation Analytics - ML service.

FastAPI + scikit-learn Isolation Forest. Every prediction is computed here;
the web app never fabricates scores. Requests must carry the shared secret in
the `X-ML-Key` header (set ML_SERVICE_KEY on both sides).
"""
from __future__ import annotations

import hmac
import os
import time
from typing import Any, Optional

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score, silhouette_score
from sklearn.preprocessing import StandardScaler

app = FastAPI(title="DES Intelligent Evaluation Analytics", version="1.0.0")
MAX_ROWS = 20000


def require_key(x_ml_key: str = Header(default="")) -> None:
    expected = os.environ.get("ML_SERVICE_KEY", "")
    if not expected or not hmac.compare_digest(x_ml_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing ML service key")


class DetectRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(..., min_length=10)
    features: list[str] = Field(..., min_length=1)
    n_estimators: int = Field(100, ge=10, le=1000)
    contamination: float = Field(0.05, gt=0.0, le=0.5)
    label_column: Optional[str] = None
    random_state: int = 42


def to_float(v: Any) -> float:
    if v is None or v == "":
        return np.nan
    try:
        return float(v)
    except (TypeError, ValueError):
        return np.nan


def to_label(v: Any) -> Optional[int]:
    s = str(v).strip().lower()
    if s in {"1", "true", "yes", "anomaly", "anomalous", "outlier", "-1"}:
        return 1
    if s in {"0", "false", "no", "normal", "inlier"}:
        return 0
    return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "algorithm": "sklearn.ensemble.IsolationForest"}


@app.post("/detect", dependencies=[Depends(require_key)])
def detect(req: DetectRequest) -> dict[str, Any]:
    if len(req.rows) > MAX_ROWS:
        raise HTTPException(400, f"At most {MAX_ROWS} rows per request")
    t0 = time.time()
    X = np.array([[to_float(r.get(f)) for f in req.features] for r in req.rows], dtype=float)
    usable = [i for i, f in enumerate(req.features) if np.isfinite(X[:, i]).sum() > 0]
    if not usable:
        raise HTTPException(400, "Selected features contain no numeric values")
    X = X[:, usable]
    features = [req.features[i] for i in usable]
    missing = int(np.isnan(X).sum())
    medians = np.nanmedian(X, axis=0)
    X = np.where(np.isnan(X), medians, X)  # median imputation
    Xs = StandardScaler().fit_transform(X)

    model = IsolationForest(n_estimators=req.n_estimators, contamination=req.contamination,
                            random_state=req.random_state, n_jobs=-1)
    pred = model.fit_predict(Xs)                 # -1 anomaly, 1 normal
    score = -model.score_samples(Xs)             # higher = more anomalous
    is_anom = pred == -1
    threshold = float(-model.offset_)

    metrics: dict[str, Any] = {
        "mode": "unsupervised",
        "records": len(req.rows),
        "anomalies": int(is_anom.sum()),
        "anomaly_rate": float(is_anom.mean()),
        "threshold": threshold,
        "score_mean": float(score.mean()),
        "score_std": float(score.std()),
        "score_mean_anomalous": float(score[is_anom].mean()) if is_anom.any() else None,
        "score_mean_normal": float(score[~is_anom].mean()) if (~is_anom).any() else None,
        "imputed_values": missing,
        "features_used": features,
    }
    if 1 < is_anom.sum() < len(is_anom) - 1:
        n = len(Xs)
        idx = np.random.default_rng(0).choice(n, size=min(n, 5000), replace=False)
        metrics["silhouette"] = float(silhouette_score(Xs[idx], is_anom[idx].astype(int)))
    # Feature contribution: standardized mean difference between groups
    if is_anom.any() and (~is_anom).any():
        diff = np.abs(Xs[is_anom].mean(0) - Xs[~is_anom].mean(0))
        metrics["feature_importance"] = {f: float(d) for f, d in sorted(zip(features, diff), key=lambda x: -x[1])}

    if req.label_column:
        labels = [to_label(r.get(req.label_column)) for r in req.rows]
        keep = [i for i, l in enumerate(labels) if l is not None]
        if len(keep) >= 10 and len({labels[i] for i in keep}) == 2:
            y = np.array([labels[i] for i in keep]); p = is_anom[keep].astype(int)
            cm = confusion_matrix(y, p, labels=[0, 1])
            metrics.update(mode="supervised_validation", labelled_records=len(keep),
                           precision=float(precision_score(y, p, zero_division=0)),
                           recall=float(recall_score(y, p, zero_division=0)),
                           f1=float(f1_score(y, p, zero_division=0)),
                           confusion_matrix={"tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1])})
        else:
            metrics["label_warning"] = "Label column needs at least 10 rows with both normal and anomaly values"

    metrics["runtime_ms"] = int((time.time() - t0) * 1000)
    return {
        "results": [{"index": i, "score": float(score[i]), "is_anomaly": bool(is_anom[i])} for i in range(len(score))],
        "metrics": metrics,
    }
