"""Generate a wholly invented, password-protected Android CAS regression fixture.

Run with Python + reportlab. No customer statement is read or embedded.
"""

from pathlib import Path

from reportlab.lib.pdfencrypt import StandardEncryption
from reportlab.pdfgen import canvas


output = Path(__file__).resolve().parents[2] / "e2e/fixtures/cas-native-synthetic.pdf"
output.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(
    str(output),
    pagesize=(842, 595),
    invariant=True,
    encrypt=StandardEncryption("synthetic-cas-test", ownerPassword="synthetic-owner"),
)
pdf.setTitle("Synthetic CAS regression fixture - no personal data")
pages = [
    [
        "Consolidated Account Statement",
        "Statement Period: 01-Jan-2024 To 31-Dec-2024",
        "Date Transaction Amount Units Price Unit / (INR)(INR)Balance",
        "Sample Mutual Fund",
        "Folio No: 10000000 / 01 PAN: AAAAA0000A KYC: OK",
        "S100 - Sample Equity Fund - Direct Plan - Growth - ISIN: INF000000001",
        "Registrar : CAMS",
        "Opening Unit Balance: 0.000",
        "02-Jan-2024 Systematic Investment (1) 1,000.00 10.000 100.0000 10.000",
        "Page 1 of 2",
        "CAMSCASWS-SYNTHETIC Version:V3.5 Live-1018",
    ],
    [
        "Consolidated Account Statement",
        "01-Jan-2024 To 31-Dec-2024",
        "Date Transaction Amount Units Price Unit / (INR)(INR)Balance",
        "03-Feb-2024 Sys. Investment(NAV Dt : 02/02/2024) (1/12) 200.00 2.000 100.0000 12.000",
        "30-Oct-2024 ***Address Updated from KRA Data***",
        "Closing Unit Balance: 12.000",
    ],
]
for lines in pages:
    text = pdf.beginText(36, 550)
    text.setFont("Helvetica", 10)
    text.setLeading(24)
    for line in lines:
        text.textLine(line)
    pdf.drawText(text)
    pdf.showPage()
pdf.save()
print(output)
