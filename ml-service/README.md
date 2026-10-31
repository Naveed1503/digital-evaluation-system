# DES ML service (Python · FastAPI · scikit-learn)

Runs the Isolation Forest for the **Intelligent Evaluation Analytics** dashboard.
The web app sends a dataset to `POST /detect`; this service returns a real anomaly
score and normal/anomaly label for every row, plus metrics (precision/recall/F1
and confusion matrix when a label column is given; silhouette, threshold and
score gap otherwise).

## Security
Every request must include header `X-ML-Key` equal to the `ML_SERVICE_KEY`
environment variable. The same key is stored in the app as `ML_SERVICE_KEY`.
Only the Controller can trigger runs (checked in the app before calling).

## Deploy on Render (free)
1. Push this project to GitHub (Lovable → GitHub → Connect).
2. In Render: **New → Blueprint**, pick the repo. It reads `ml-service/render.yaml`.
3. When asked for `ML_SERVICE_KEY`, paste the key generated in Lovable.
4. After deploy, copy the service URL (e.g. `https://des-ml-service.onrender.com`)
   and save it in Lovable as `ML_SERVICE_URL`.
5. Open `https://<your-url>/health` — it should return `{"status":"ok"}`.

Free Render services sleep after 15 minutes idle; the first run after that takes ~30–50 s.

## Run locally
```bash
pip install -r requirements.txt
ML_SERVICE_KEY=dev-key uvicorn main:app --port 8001
python -m pytest -q   # tests
```

## API
`POST /detect` body:
```json
{ "rows": [{...}], "features": ["marks_pct", "moderation_change"],
  "n_estimators": 100, "contamination": 0.05, "label_column": "is_anomaly" }
```
