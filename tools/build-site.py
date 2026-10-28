from pathlib import Path
root=Path(__file__).resolve().parents[1]
css='\n'.join((root/'assets/graphite'/n).read_text() for n in ['site.css','responsive.css'])
js='\n'.join((root/'assets/graphite'/n).read_text() for n in ['icons.js','session.js','conference.js','league.js','workflows.js'])
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#24262B"><meta name="description" content="Your teams, your people, your Saturday. The college football dynasty companion."><meta name="robots" content="noindex,nofollow"><meta name="sf-version" content="10.0.0-beta.10"><link rel="icon" type="image/webp" href="assets/graphite/brand/foundry-shield.webp"><title>Saturday Foundry</title><style>'''+css+'''</style></head><body><a class="sr-only" href="#mainContent">Skip to content</a><div class="site-app" id="app"><main class="content"><h1>Saturday Foundry</h1><p>Loading your league…</p><noscript>Open Saturday Foundry in Safari or Chrome with JavaScript enabled.</noscript></main></div><dialog class="sheet" id="detailSheet" aria-labelledby="sheetTitle"></dialog><script>'''+js+'''</script></body></html>'''
(root/'foundry.html').write_text(html)
print('Built foundry.html:',len(html),'characters')

# Keep the production entry point intact; reuse its existing advanced workflows.
base=(root/'index.html').read_bytes().decode('utf-8')
bridge='\n<link rel="stylesheet" href="assets/graphite/league-tools.css?v=10.0.0-beta.6">\n<script src="assets/graphite/league-tools.js?v=10.0.0-beta.6"></script>\n'
(root/'league-tools.html').write_bytes((base+bridge).encode('utf-8'))
print('Built league-tools.html from unchanged index.html')
