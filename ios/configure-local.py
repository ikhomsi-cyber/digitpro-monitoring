"""Copy only public Supabase configuration; never copy service-role or provider secrets."""
from pathlib import Path
from urllib.parse import urlparse
import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--api-url', required=True, help='HTTPS origin serving the new mobile routes')
args = parser.parse_args()
u = urlparse(args.api_url)
if u.scheme != 'https' or not u.netloc or u.username or u.password or u.query or u.fragment or u.path not in ('','/'):
    parser.error('--api-url must be an HTTPS origin')
root = Path(__file__).resolve().parent
values = {}
for line in (root.parent/'.env.local').read_text().splitlines():
    key, sep, value = line.partition('=')
    if sep and key.strip() in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'):
        values[key.strip()] = value.strip().strip('"').strip("'")
if len(values) != 2 or not all(values.values()):
    parser.error('Public Supabase configuration missing from .env.local')
def escaped(value):
    if any(c in value for c in '\n\r$'):
        raise ValueError('Unsupported xcconfig characters')
    return value.replace('://', ':/$()/')
out = root/'DigitPro/Config/Local.xcconfig'
out.write_text('// Public client configuration; ignored by Git.\n' +
    'SUPABASE_URL = '+escaped(values['NEXT_PUBLIC_SUPABASE_URL'])+'\n'+
    'SUPABASE_ANON_KEY = '+escaped(values['NEXT_PUBLIC_SUPABASE_ANON_KEY'])+'\n'+
    'DIGITPRO_API_URL = '+escaped(args.api_url.rstrip('/'))+'\n')
out.chmod(0o600)
print('Public configuration written; credentials not printed.')
