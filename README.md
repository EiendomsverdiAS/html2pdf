# html2pdf

A Docker-based web service that converts websites to PDF format and provides PDF compression capabilities.

### Technologies:
- **Node.js** with Express for the web server
- **Puppeteer** for web page rendering and PDF generation
- **Ghostscript** for PDF compression
- **Docker** for containerization and deployment
- **Application Insights** for telemetry and monitoring

### Features:
- Generate PDFs from websites with optional compression
- Compress existing PDF files with configurable quality settings

## Disclaimer

This project is provided **"as is"**, without any warranty or guarantee of any kind. See the [AGPLv3 License](./LICENSE) for full terms.

## Building and Running Locally

Install dependencies:
```bash
npm install
```

Build and run the Docker container:
```bash
docker build -t html2pdf .
docker run --rm -p 3000:3000 html2pdf
```

## Usage Examples

### Generate PDF from Website
Generate a compressed PDF from a website:
```bash
curl -X POST http://localhost:3000/generateReport -H "Content-Type: application/json" -d "{\"url\":\"eiendomsverdi.no\",\"compression\":true}" --output output.pdf
```

### Compress Existing PDF
Compress a local PDF file:
```bash
curl -X POST -H "Content-Type: application/pdf" --data-binary "@<YOUR_FILE>" http://localhost:3000/compressPdf/150 --output output2.pdf
```

## License

This project is distributed under the [GNU Affero General Public License version 3 (AGPLv3)](https://www.gnu.org/licenses/agpl-3.0.en.html).