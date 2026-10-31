import http from 'node:http';
import {readFile} from 'node:fs/promises';
const png = new URL('../本格修仙.png', import.meta.url);
http.createServer(async (req, res) => {
  if (req.url !== '/release.png') { res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type': 'image/png', 'Access-Control-Allow-Origin': 'http://localhost:8000', 'Cache-Control': 'no-store'});
  res.end(await readFile(png));
}).listen(18749, '127.0.0.1');
