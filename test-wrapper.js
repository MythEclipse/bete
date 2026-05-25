const init = {
  headers: {
    Accept: 'application/json',
    Authorization: 'Bearer sk-4ab633fd86509c5b-8r850e-8c58839a',
    'Content-Type': 'application/json',
    'User-Agent': 'OpenAI/JS 6.38.0',
    'x-stainless-arch': 'x64',
    'x-stainless-lang': 'js',
    'x-stainless-os': 'Linux',
    'x-stainless-package-version': '6.38.0',
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': 'v26.2.0'
  }
};

const headers = new Headers(init?.headers);
headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
for (const key of Array.from(headers.keys())) {
  if (key.toLowerCase().startsWith("x-stainless")) {
    headers.delete(key);
  }
}

for (const [k, v] of headers.entries()) {
  console.log(`${k}: ${v}`);
}
