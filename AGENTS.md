<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Evaluation workflow writes (marks, assignment, publishing) go through SECURITY DEFINER SQL functions (auto_assign, reassign_script, save_evaluation_draft, submit_evaluation, submit_moderation, publish_results); moderator mark changes require a reason and are logged in mark_revisions — they validate role, ownership and mark limits server-side.
- Student identity lives only in script_owners (admin/student readable) so evaluators and moderators see anonymous script codes only.
- Roles are in user_roles checked via has_role(); the first account to sign up becomes admin, later ones default to student.
- Grade bands and final-mark rule live in src/lib/grading.ts with tests next to it.
- AppShell uses a sheet navigation below the desktop breakpoint and a persistent desktop sidebar; workflow tables scroll within their own containers so phone pages remain viewport-width.
- Isolation Forest runs only in the external Python service in ml-service/ (FastAPI + scikit-learn), called from src/lib/analytics.functions.ts with ML_SERVICE_URL/ML_SERVICE_KEY (X-ML-Key header); the app never computes or fakes anomaly predictions itself.
- ML anomaly flags are advisory: moderators record decisions only via review_ml_flag(); no ML code path writes to marks.
- AI suggested marks (src/lib/ai-mark.*) are suggestions only; the evaluator must enter/accept marks, and values are clamped to each question's limits.
- research/ holds the ASAP-SAS paper experiment (Python, not part of the web app); every number in research/paper/paper.tex is generated from research/outputs by make_paper.py, so rerun rather than hand-edit results.
- Reuse BrandLogo for website branding and derive browser icons from its image source so all surfaces retain the same logo.
