# Add literature-based metric and accuracy comparison (des_v3)

## Goal
Compare traditional paper marking, earlier digital/on-screen marking systems from published studies, and our Digital Evaluation System (DES). Use real published figures and cite every one.

## Steps
1. **Literature research (web).** Collect verified, citable metrics from peer-reviewed or official studies:
   - Paper marking: totalling and posting error rates, re-evaluation change rates, turnaround time, marker agreement (for example, studies of manual tabulation errors and re-valuation outcomes).
   - On-screen and earlier digital marking: marker reliability and agreement (Johnson et al. 2010, Cambridge Assessment and Ofqual on-screen marking studies, Coniam), turnaround, and audit capability.
   - Anomaly or quality-control detection in marking, if published.
   I will keep only sources whose DOI or URL I can confirm, adding about 4–6 new references, for 14–18 in total.
2. **New subsection in Methodology: "Comparison with Existing Evaluation Methods"**
   - Table A, published metrics: method, metric, reported value, source [n].
   - Table B, feature and accuracy comparison: Paper vs Earlier OSM vs DES, covering arithmetic totalling error, mark-limit validation, blind evaluation, moderation traceability, anomaly flagging and result-publication delay.
   - DES values come only from what is measured or built: automated totalling (O(q), with no manual sum step), server-side mark-limit checks, and the Isolation Forest demo (precision 0.88, recall 1.00, F1 0.936 on synthetic data, in-sample).
3. **Graph:** a grouped bar chart of the published error rates or agreement values against the DES demo metrics, clearly labelled as coming from different sources and datasets.
4. **Accuracy discussion paragraph:** explain why DES should reduce tabulation and posting errors (computed totals and validation). State that a direct accuracy claim against other systems needs a controlled study on the same scripts, which is listed as future work.
5. Update the Results/Conclusion references and renumber them in IEEE order.
6. Produce **des_v3.docx + des_v3.pdf**, render every page and check them. Add both files to the IEEE Papers collection.

## Integrity rule
I will not invent percentages for DES. Where no measurement exists, the paper will say "eliminated by design (automated)" or "not yet measured", rather than give a made-up number.
