"""Generate synthetic EPFO Member Passbook PDFs for the #740 import flow.

The text comes from src/testing/epfPassbookFixture.ts, so the PDFs match the
unit tests line for line. Every name, ID and amount is invented.

Needs PyMuPDF and Node 22.6 or later (to load the TypeScript fixture):
    python scripts/fixtures/generate-epf-passbook-pdfs.py
"""

import json
import subprocess
from pathlib import Path

import pymupdf

root = Path(__file__).resolve().parents[2]
fixture = (root / "src/testing/epfPassbookFixture.ts").as_uri()
script = (
    f'import {{ passbookChain }} from "{fixture}";'
    "process.stdout.write(JSON.stringify(passbookChain));"
)
texts = json.loads(subprocess.run(
    ["node", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script],
    check=True, capture_output=True, text=True, cwd=root,
).stdout)

names = {
    "oldFirstYear": "epf-passbook-old-2021.pdf",
    "oldClaimYear": "epf-passbook-old-2022.pdf",
    "newFirstYear": "epf-passbook-new-2022.pdf",
}
for key, name in names.items():
    doc = pymupdf.open()
    doc.set_metadata({"title": "Synthetic EPF passbook fixture - no personal data"})
    page = doc.new_page(width=595, height=842)
    # One text run per line, like the real passbook rows the device reads.
    for index, line in enumerate(texts[key].splitlines()):
        page.insert_text((24, 40 + index * 12), line, fontname="helv", fontsize=7)
    output = root / "e2e/fixtures" / name
    doc.save(str(output), garbage=4, deflate=True, no_new_id=True)
    print(output.relative_to(root))
