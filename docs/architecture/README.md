# OSINTiger Architecture Diagram System

This directory houses the interactive, editable diagrams.net (draw.io) architecture diagrams for OSINTiger.

---

## Diagram Index

| Diagram | Source File | Description | Interactive Lightbox |
| :--- | :--- | :--- | :--- |
| **System Architecture & Trust Boundaries** | [`architecture.drawio.svg`](architecture.drawio.svg) | C4 Component model showing the analyst workbench, investigation pipeline, evidence normalizer, provenance ledger, AES-256-GCM key vault, and external intelligence tiers. | [Open in Lightbox](https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=architecture.drawio.svg#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fshivanshjain456%2Fosintiger%2Fmain%2Fdocs%2Farchitecture%2Farchitecture.drawio.svg) |
| **Investigation Lifecycle & Zero-Hallucination Pipeline** | [`core-flows.drawio.svg`](core-flows.drawio.svg) | 9-step intelligence pipeline showing target intake, deterministic telemetry collection, SHA-256 hash provenance, Jaro-Winkler entity resolution, ACH agent debate, and verified citation export. | [Open in Lightbox](https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=core-flows.drawio.svg#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fshivanshjain456%2Fosintiger%2Fmain%2Fdocs%2Farchitecture%2Fcore-flows.drawio.svg) |

---

## How to View Interactively

Click the **Open in Lightbox** links above (or the embedded images in the root `README.md`). 
The diagram opens in fullscreen vector mode within diagrams.net, enabling:
* Seamless zooming into subsystem components, entity resolution logic, and cryptographic vaults.
* Panning across trust boundaries between public intelligence APIs and private analyst sessions.
* Full-screen presentation mode for technical and architectural reviews.

---

## How to Edit Diagrams

These diagrams use the editable SVG format (`.drawio.svg`), combining visible vector shapes with the complete diagrams.net XML model.

### Option A: Edit Directly on GitHub via diagrams.net
* [Edit System Architecture](https://app.diagrams.net/#Hshivanshjain456%2Fosintiger%2Fmain%2Fdocs%2Farchitecture%2Farchitecture.drawio.svg)
* [Edit Investigation Pipeline Flow](https://app.diagrams.net/#Hshivanshjain456%2Fosintiger%2Fmain%2Fdocs%2Farchitecture%2Fcore-flows.drawio.svg)

### Option B: Edit Locally via VS Code / Desktop App
1. Install the official **Draw.io Integration** extension in VS Code.
2. Open either `docs/architecture/architecture.drawio.svg` or `docs/architecture/core-flows.drawio.svg` directly.
3. Edit shapes, connector labels, or intelligence sources.
4. Save the file. VS Code will automatically synchronize the embedded XML and visible vector SVG layers.
5. Commit and push:
   ```bash
   git add docs/architecture/
   git commit -m "docs(architecture): update investigation pipeline components"
   git push origin main
   ```

---

## Synchronization Rules & Guidelines

When expanding OSINTiger connectors, agents, or data models:
1. **Decoupled Telemetry**: All external intelligence sources must be called via deterministic TypeScript fetch handlers, never autonomous, unverified model loops.
2. **Zero-Hallucination Citations**: Every fact in an intelligence report must link to an immutable Evidence ID verified against the SHA-256 payload hash in the provenance ledger.
3. **BYO-Key Security**: User API credentials must be encrypted using AES-256-GCM before writing to the database. Plaintext keys must never exist in persistent storage or logs.
4. **Data Privacy**: Never include real target identities, private investigation data, or active API keys in diagrams or documentation examples.
