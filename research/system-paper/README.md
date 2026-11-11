# DES system paper source

`paper.tex` is the revised IEEE conference paper. It contains only Abstract, Keywords, Introduction, Methodology, Results, Conclusion and References.

## Compile

Keep `system-architecture.pdf` beside `paper.tex`, then run:

```bash
pdflatex paper.tex
pdflatex paper.tex
```

The TeX Live packages used are IEEEtran, graphicx, booktabs, amsmath, array, cite, url, hyperref and balance (from the `preprint` bundle).

`system-architecture.png` is a high-resolution raster copy of the figure. `make_architecture.py` regenerates both figure formats with Matplotlib.

The reported verification results were obtained on 11 November 2026: 19 application tests passed, two FastAPI service tests passed, and the deployed `/health` endpoint returned a healthy Isolation Forest service response. No educational effectiveness or institutional anomaly-accuracy results are claimed.
