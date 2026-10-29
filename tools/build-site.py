from pathlib import Path
import argparse
import hashlib
import json
import re
root=Path(__file__).resolve().parents[1]
args = argparse.ArgumentParser(description="Build the native site and preserved league tools.")
args.add_argument('--check', action='store_true', help='Fail if committed build outputs are stale; do not write files.')
check = args.parse_args().check
version = json.loads((root/'package.json').read_text())['version']
if not re.fullmatch(r'\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?', version):
    raise SystemExit('Unsupported release version')
major = '.'.join(version.split('.')[:2])
badge = major + (' RC ' + version.split('-rc.')[1] if '-rc.' in version else ' BETA ' + version.split('-beta.')[1] if '-beta.' in version else '')
release = json.loads((root/'release.json').read_text())
base_bytes = (root/release['legacyRuntime']).read_bytes()
if hashlib.sha256(base_bytes).hexdigest() != release['legacySha256']:
    raise SystemExit('Preserved legacy runtime differs from the recovery baseline')
css='\n'.join((root/'assets/graphite'/n).read_text() for n in ['site.css','responsive.css','report.css','career-hub.css'])
js='\n'.join((root/'assets/graphite'/n).read_text() for n in ['icons.js','session.js','conference.js','league.js','workflows.js','report-engine.js','artwork-catalog.js','report.js','career-hub.js'])
js=js.replace('__SF_VERSION__',version).replace('__SF_BADGE__',badge)
js+='\nstart();'
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#24262B"><meta name="description" content="Your teams, your people, your Saturday. The college football dynasty companion."><meta name="robots" content="noindex,nofollow"><meta name="sf-version" content="'''+version+'''"><link rel="icon" type="image/webp" href="assets/graphite/brand/foundry-shield.webp"><meta name="apple-mobile-web-app-title" content="Foundry"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="apple-touch-icon" href="/assets/graphite/brand/foundry-shield.webp"><link rel="manifest" href="/manifest.webmanifest"><title>Saturday Foundry</title><style>'''+css+'''</style></head><body><a class="sr-only" href="#mainContent">Skip to content</a><div class="site-app" id="app"><main class="content"><h1>Saturday Foundry</h1><p>Loading your league…</p><noscript>Open Saturday Foundry in Safari or Chrome with JavaScript enabled.</noscript></main></div><dialog class="sheet" id="detailSheet" aria-labelledby="sheetTitle"></dialog><script>'''+js+'''</script></body></html>'''
# Both entry points render the same native site; existing preview bookmarks keep working.
base=base_bytes.decode('utf-8').replace('<html lang="en">','<html lang="en" class="sf-tools-theme">',1)
base=base.replace('</head>',f'<meta name="sf-version" content="{version}"></head>',1)
bridge=f'\n<link rel="stylesheet" href="assets/graphite/league-tools.css?v={version}">\n<script src="assets/graphite/league-tools.js?v={version}"></script>\n'
outputs={'index.html':html,'foundry.html':html,'league-tools.html':base+bridge}
stale=[]
for name,content in outputs.items():
    data=content.encode('utf-8')
    destination=root/name
    if check:
        if not destination.exists() or destination.read_bytes()!=data:
            stale.append(name)
    else:
        destination.write_bytes(data)
        print(f'Built {name}: {len(data)} bytes')
if stale:
    raise SystemExit('Stale release outputs: '+', '.join(stale)+'. Run npm run build.')
if check:
    print('All release outputs match their source files.')
