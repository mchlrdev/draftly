# Uploaded HTML in a sandboxed iframe is the review surface

Draftly shows a reviewer's comments on HTML the operator uploaded, not on a PDF, a screenshot, or a live Paper file. The page is loaded in a sandboxed iframe without scripts; pins sit on an overlay in design coordinates. Same-document embedding would leak the page's CSS into the chrome. PDF and bitmap were rejected because they either feel like a document or go soft and huge on tall landing pages. There is no Paper exporter in the product: Draftly is source-agnostic.
