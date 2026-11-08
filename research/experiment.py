# %% [markdown]
# # Automatic Short-Answer Scoring for a Digital Evaluation System
# **Dataset:** Hewlett Foundation ASAP Short Answer Scoring (ASAP-SAS), 10 prompts (sets 1,2,5,6,10 scored 0-3; sets 3,4,7,8,9 scored 0-2).
# Labelled data = the official train + validation releases (13,634 answers). We create our own stratified 80/20 split per prompt (seed 42).
#
# **Models compared (one model per prompt, as in the ASAP competition):**
# 1. Majority-class baseline
# 2. Ridge regression on TF-IDF (rounded to the nearest valid score)
# 3. Logistic Regression on TF-IDF
# 4. Linear SVM on TF-IDF
# 5. Random Forest on SVD(TF-IDF) + handcrafted features
# 6. XGBoost on SVD(TF-IDF) + handcrafted features
#
# **Metrics:** Quadratic Weighted Kappa (QWK, the official ASAP metric; averaged with Fisher-z), accuracy, macro-F1, RMSE.
# Agreement between the two human raters (Score1 vs Score2) is reported as the reference ceiling.

# %%
import re, json, os, time, warnings
import numpy as np, pandas as pd
from scipy.sparse import hstack, csr_matrix
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import cohen_kappa_score, accuracy_score, f1_score, mean_squared_error, confusion_matrix
from xgboost import XGBClassifier
import matplotlib
import matplotlib.pyplot as plt
warnings.filterwarnings("ignore")
SEED = 42
np.random.seed(SEED)
DATA, OUT = "data", "outputs"
os.makedirs(OUT, exist_ok=True)
NAVY, GOLD = "#14213d", "#c9a227"
PALETTE = ["#9aa5b8", "#5b6c8f", "#14213d", "#c9a227", "#8c6d1f", "#2f6f5e", "#b5523b"]

# %%
df = pd.concat([pd.read_csv(f"{DATA}/train.csv"), pd.read_csv(f"{DATA}/validation.csv")], ignore_index=True)
df = df[["Id", "essay_set", "prompt", "Score1", "Score2", "essay_text"]].dropna(subset=["essay_text"])
if os.environ.get("ONLY"): df = df[df.essay_set == int(os.environ["ONLY"])]
df["Score1"] = df.Score1.astype(int); df["Score2"] = df.Score2.astype(int)
print("Labelled answers:", len(df))
summary = df.groupby("essay_set").agg(answers=("Id", "size"), max_score=("Score1", "max"),
                                       mean_score=("Score1", "mean"), mean_words=("essay_text", lambda s: s.str.split().str.len().mean())).round(2)
print(summary)

# %%
def qwk(a, b): return cohen_kappa_score(a, b, weights="quadratic")
def fisher_mean(ks):
    ks = np.clip(np.array(ks, dtype=float), -0.999, 0.999)
    return float(np.tanh(np.mean(np.arctanh(ks))))

def handcrafted(texts, key_text):
    key = set(re.findall(r"[a-z]{4,}", key_text.lower()))
    rows = []
    for t in texts:
        w = re.findall(r"[a-zA-Z']+", t.lower()); n = len(w) or 1
        rows.append([len(t), len(w), len(set(w)) / n, np.mean([len(x) for x in w]) if w else 0,
                     t.count("."), len(set(w) & key), len(set(w) & key) / (len(key) or 1)])
    return np.array(rows, dtype=float)

def features(train_txt, test_txt, key_text):
    word = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)
    char = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=3, sublinear_tf=True, max_features=10000)
    Xw_tr, Xw_te = word.fit_transform(train_txt), word.transform(test_txt)
    Xc_tr, Xc_te = char.fit_transform(train_txt), char.transform(test_txt)
    H_tr, H_te = handcrafted(train_txt, key_text), handcrafted(test_txt, key_text)
    mu, sd = H_tr.mean(0), H_tr.std(0) + 1e-9
    Hs_tr, Hs_te = (H_tr - mu) / sd, (H_te - mu) / sd
    X_tr = hstack([Xw_tr, Xc_tr, csr_matrix(Hs_tr)]).tocsr(); X_te = hstack([Xw_te, Xc_te, csr_matrix(Hs_te)]).tocsr()
    svd = TruncatedSVD(100, random_state=SEED)
    S_tr = np.hstack([svd.fit_transform(hstack([Xw_tr, Xc_tr])), Hs_tr]); S_te = np.hstack([svd.transform(hstack([Xw_te, Xc_te])), Hs_te])
    return X_tr, X_te, S_tr, S_te

MODELS = ["Majority", "Ridge", "LogReg", "LinearSVM", "RandomForest", "XGBoost"]

def fit_predict(name, X_tr, X_te, S_tr, S_te, y_tr, lo, hi):
    if name == "Majority": return np.full(X_te.shape[0], np.bincount(y_tr).argmax())
    if name == "Ridge": return np.clip(np.rint(Ridge(alpha=1.0).fit(X_tr, y_tr).predict(X_te)), lo, hi).astype(int)
    if name == "LogReg": return LogisticRegression(C=4, max_iter=3000).fit(X_tr, y_tr).predict(X_te)
    if name == "LinearSVM": return LinearSVC(C=0.5).fit(X_tr, y_tr).predict(X_te)
    if name == "RandomForest": return RandomForestClassifier(300, n_jobs=-1, random_state=SEED, class_weight="balanced_subsample").fit(S_tr, y_tr).predict(S_te)
    if name == "XGBoost":
        classes = np.unique(y_tr); m = {c: i for i, c in enumerate(classes)}
        clf = XGBClassifier(n_estimators=250, max_depth=5, learning_rate=0.08, subsample=0.9, colsample_bytree=0.7,
                            tree_method="hist", random_state=SEED, n_jobs=4, verbosity=0)
        clf.fit(S_tr, np.array([m[c] for c in y_tr]))
        return classes[clf.predict(S_te)]

# %% [markdown]
# ## Experiment 1 — Hold-out evaluation (80/20 stratified split per prompt)

# %%
rows, preds_all, split_ids = [], [], {}
t0 = time.time()
for s, g in df.groupby("essay_set"):
    tr, te = train_test_split(g, test_size=0.2, stratify=g.Score1, random_state=SEED)
    split_ids[int(s)] = te.Id.tolist()
    lo, hi = int(g.Score1.min()), int(g.Score1.max())
    X_tr, X_te, S_tr, S_te = features(tr.essay_text.tolist(), te.essay_text.tolist(), g.prompt.iloc[0])
    y_tr, y_te = tr.Score1.values, te.Score1.values
    rows.append(dict(set=s, model="Human (rater 2)", qwk=qwk(te.Score2, y_te), acc=accuracy_score(y_te, te.Score2),
                     f1=f1_score(y_te, te.Score2, average="macro"), rmse=np.sqrt(mean_squared_error(y_te, te.Score2))))
    for name in MODELS:
        p = fit_predict(name, X_tr, X_te, S_tr, S_te, y_tr, lo, hi)
        rows.append(dict(set=s, model=name, qwk=qwk(y_te, p), acc=accuracy_score(y_te, p),
                         f1=f1_score(y_te, p, average="macro"), rmse=np.sqrt(mean_squared_error(y_te, p))))
        preds_all += [dict(Id=i, set=s, model=name, y=a, p=b) for i, a, b in zip(te.Id, y_te, p)]
    print(f"set {s} done ({time.time()-t0:.0f}s)", flush=True)
res = pd.DataFrame(rows); preds = pd.DataFrame(preds_all)
json.dump(split_ids, open(f"{OUT}/test_split_ids.json", "w"))

# %%
order = ["Majority", "Ridge", "LogReg", "LinearSVM", "RandomForest", "XGBoost", "Human (rater 2)"]
overall = res.groupby("model").agg(QWK=("qwk", fisher_mean), Accuracy=("acc", "mean"), MacroF1=("f1", "mean"), RMSE=("rmse", "mean")).reindex(order).round(4)
per_set = res.pivot(index="set", columns="model", values="qwk")[order].round(3)
pd.set_option("display.width", 200); pd.set_option("display.max_columns", 20)
print("Table 2. Overall hold-out results\n", overall)
print("\nTable 3. QWK per prompt\n", per_set)
overall.to_csv(f"{OUT}/table2_overall_results.csv"); per_set.to_csv(f"{OUT}/table3_qwk_per_prompt.csv"); summary.to_csv(f"{OUT}/table1_dataset_summary.csv")
preds.to_csv(f"{OUT}/holdout_predictions.csv", index=False)

# %% [markdown]
# ## Experiment 2 — 5-fold cross-validation (robustness) for the two strongest models

# %%
best2 = overall.drop(["Human (rater 2)", "Majority"]).QWK.sort_values(ascending=False).index[:2].tolist()
cv_rows = []
for s, g in df.groupby("essay_set"):
    lo, hi = int(g.Score1.min()), int(g.Score1.max())
    for fold, (a, b) in enumerate(StratifiedKFold(5, shuffle=True, random_state=SEED).split(g, g.Score1)):
        tr, te = g.iloc[a], g.iloc[b]
        X_tr, X_te, S_tr, S_te = features(tr.essay_text.tolist(), te.essay_text.tolist(), g.prompt.iloc[0])
        for name in best2:
            p = fit_predict(name, X_tr, X_te, S_tr, S_te, tr.Score1.values, lo, hi)
            cv_rows.append(dict(set=s, fold=fold, model=name, qwk=qwk(te.Score1.values, p)))
    print(f"cv set {s} done", flush=True)
cv = pd.DataFrame(cv_rows)
cv_tab = cv.groupby(["model", "fold"]).qwk.apply(fisher_mean).groupby("model").agg(["mean", "std"]).round(4)
cv_tab.columns = ["Mean QWK (5-fold)", "Std"]
print("Table 4. Cross-validation\n", cv_tab); cv_tab.to_csv(f"{OUT}/table4_cross_validation.csv")

# %% [markdown]
# ## Experiment 3 — Learning curve (how much marked data is needed?)

# %%
best = best2[0]; fracs = [0.1, 0.2, 0.4, 0.6, 0.8, 1.0]; lc = []
for s, g in df.groupby("essay_set"):
    tr, te = train_test_split(g, test_size=0.2, stratify=g.Score1, random_state=SEED)
    lo, hi = int(g.Score1.min()), int(g.Score1.max())
    for f in fracs:
        sub = tr if f == 1.0 else train_test_split(tr, train_size=f, stratify=tr.Score1, random_state=SEED)[0]
        X_tr, X_te, S_tr, S_te = features(sub.essay_text.tolist(), te.essay_text.tolist(), g.prompt.iloc[0])
        lc.append(dict(set=s, frac=f, n=len(sub), qwk=qwk(te.Score1.values, fit_predict(best, X_tr, X_te, S_tr, S_te, sub.Score1.values, lo, hi))))
lc = pd.DataFrame(lc)
lc_tab = lc.groupby("frac").agg(avg_train_answers=("n", "mean"), QWK=("qwk", fisher_mean)).round(3)
print(f"Table 5. Learning curve ({best})\n", lc_tab); lc_tab.to_csv(f"{OUT}/table5_learning_curve.csv")

# %% [markdown]
# ## Figures

# %%
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
fig, ax = plt.subplots(figsize=(8, 3.6))
dist = df.groupby(["essay_set", "Score1"]).size().unstack(fill_value=0)
(dist.div(dist.sum(1), axis=0) * 100).plot(kind="bar", stacked=True, ax=ax, color=["#b5523b", "#9aa5b8", "#5b6c8f", NAVY], width=0.75)
ax.set_xlabel("Prompt (essay set)"); ax.set_ylabel("% of answers"); ax.set_title("Fig. 1  Human score distribution per prompt"); ax.legend(title="Score", bbox_to_anchor=(1.01, 1)); plt.xticks(rotation=0)
plt.tight_layout(); plt.savefig(f"{OUT}/fig1_score_distribution.png", dpi=200); plt.show()

fig, ax = plt.subplots(figsize=(8, 3.8))
o = overall.reset_index()
bars = ax.bar(o.model, o.QWK, color=[GOLD if m == best else ("#2f6f5e" if m.startswith("Human") else NAVY) for m in o.model])
for b, v in zip(bars, o.QWK): ax.text(b.get_x() + b.get_width() / 2, v + 0.01, f"{v:.3f}", ha="center", fontsize=9)
ax.set_ylabel("Mean QWK (Fisher-z)"); ax.set_ylim(0, 1); ax.set_title("Fig. 2  Overall agreement with human markers (hold-out)"); plt.xticks(rotation=15)
plt.tight_layout(); plt.savefig(f"{OUT}/fig2_model_comparison.png", dpi=200); plt.show()

fig, ax = plt.subplots(figsize=(10, 4.2))
ms = [m for m in order if m != "Majority"]; w = 0.8 / len(ms); x = np.arange(len(per_set))
for i, m in enumerate(ms):
    ax.bar(x + i * w - 0.4 + w / 2, per_set[m], w, label=m, color=PALETTE[i + 1] if not m.startswith("Human") else "#cfd4dc", edgecolor="white", linewidth=0.3)
ax.set_xticks(x); ax.set_xticklabels([f"Set {s}" for s in per_set.index]); ax.set_ylabel("QWK"); ax.set_ylim(0, 1.05)
ax.set_title("Fig. 3  QWK per prompt by model"); ax.legend(ncol=6, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.1))
plt.tight_layout(); plt.savefig(f"{OUT}/fig3_qwk_per_prompt.png", dpi=200); plt.show()

pb = preds[preds.model == best]
cm = confusion_matrix(pb.y, pb.p, labels=[0, 1, 2, 3]); cmn = cm / np.maximum(cm.sum(1, keepdims=True), 1)
fig, ax = plt.subplots(figsize=(4.8, 4.2))
ax.imshow(cmn, cmap="Blues", vmin=0, vmax=1)
for i in range(4):
    for j in range(4): ax.text(j, i, f"{cm[i,j]}\n{cmn[i,j]*100:.0f}%", ha="center", va="center", fontsize=8, color="white" if cmn[i, j] > 0.5 else NAVY)
ax.set_xticks(range(4)); ax.set_yticks(range(4)); ax.set_xlabel("Predicted score"); ax.set_ylabel("Human score"); ax.set_title(f"Fig. 4  Confusion matrix — {best}")
plt.tight_layout(); plt.savefig(f"{OUT}/fig4_confusion_matrix.png", dpi=200); plt.show()

fig, ax = plt.subplots(figsize=(6, 3.6))
ax.plot(lc_tab.avg_train_answers, lc_tab.QWK, marker="o", color=NAVY, lw=2)
for xv, yv in zip(lc_tab.avg_train_answers, lc_tab.QWK): ax.annotate(f"{yv:.3f}", (xv, yv), textcoords="offset points", xytext=(0, 7), ha="center", fontsize=8)
ax.set_xlabel("Marked answers used for training (per prompt)"); ax.set_ylabel("Mean QWK"); ax.set_title(f"Fig. 5  Learning curve — {best}")
plt.tight_layout(); plt.savefig(f"{OUT}/fig5_learning_curve.png", dpi=200); plt.show()

# %% [markdown]
# ## Experiment 4 — Trained models vs. LLM rubric scoring (the method behind the app's "AI suggested mark")
# A stratified sample of 20 hold-out answers per prompt (200 total) was scored zero-shot by `openai/gpt-6-astra`
# from the question + official rubric only (no training data). Predictions come from `llm_eval.py` (cached in `outputs/llm_predictions.csv`).
# All models are compared on exactly the same 200 answers.

# %%
if os.path.exists(f"{OUT}/llm_predictions.csv"):
    llm = pd.read_csv(f"{OUT}/llm_predictions.csv")
    cmp_rows = []
    for name in ["Ridge", "LogReg", "LinearSVM", "RandomForest", "XGBoost"]:
        m = llm[["Id"]].merge(preds[preds.model == name], on="Id")
        cmp_rows.append(dict(model=name, QWK=fisher_mean([qwk(g.y, g.p) for _, g in m.groupby("set")]), Accuracy=accuracy_score(m.y, m.p), n=len(m)))
    cmp_rows.append(dict(model="LLM zero-shot (gpt-6-astra)", QWK=fisher_mean([qwk(g.y, g.p) for _, g in llm.groupby("set")]), Accuracy=accuracy_score(llm.y, llm.p), n=len(llm)))
    hum = df.set_index("Id").loc[llm.Id]
    cmp_rows.append(dict(model="Human (rater 2)", QWK=fisher_mean([qwk(g.Score1, g.Score2) for _, g in hum.groupby("essay_set")]), Accuracy=accuracy_score(hum.Score1, hum.Score2), n=len(hum)))
    cmp = pd.DataFrame(cmp_rows).set_index("model").round(4)
    print("Table 6. Same-sample comparison (200 answers)\n", cmp); cmp.to_csv(f"{OUT}/table6_llm_comparison.csv")
    fig, ax = plt.subplots(figsize=(8, 3.8))
    bars = ax.bar(cmp.index, cmp.QWK, color=[GOLD if "LLM" in i else ("#2f6f5e" if "Human" in i else NAVY) for i in cmp.index])
    for b_, v in zip(bars, cmp.QWK): ax.text(b_.get_x() + b_.get_width() / 2, v + 0.01, f"{v:.3f}", ha="center", fontsize=9)
    ax.set_ylim(0, 1); ax.set_ylabel("Mean QWK"); ax.set_title("Fig. 6  Trained models vs. zero-shot LLM (same 200 answers)"); plt.xticks(rotation=15, fontsize=8)
    plt.tight_layout(); plt.savefig(f"{OUT}/fig6_llm_comparison.png", dpi=200); plt.show()
else:
    print("outputs/llm_predictions.csv not found — run llm_eval.py first")
