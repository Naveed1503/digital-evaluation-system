"""Builds automatic_short_answer_scoring.ipynb from experiment.py and executes it in place."""
import re
import nbformat
from nbclient import NotebookClient

src = open("experiment.py").read()
cells = []
for chunk in re.split(r"^# %%", src, flags=re.M)[1:]:
    if chunk.startswith(" [markdown]"):
        lines = chunk.split("\n", 1)[1].strip().splitlines()
        cells.append(nbformat.v4.new_markdown_cell("\n".join(l[2:] if l.startswith("# ") else l.lstrip("#") for l in lines)))
    else:
        cells.append(nbformat.v4.new_code_cell(chunk.strip()))
nb = nbformat.v4.new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3"}})
nbformat.write(nb, "automatic_short_answer_scoring.ipynb")
NotebookClient(nb, timeout=None, kernel_name="python3", resources={"metadata": {"path": "."}}).execute()
nbformat.write(nb, "automatic_short_answer_scoring.ipynb")
print("NOTEBOOK DONE", flush=True)
