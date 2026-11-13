// Optional local preview only; the application itself is entirely static.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(option('--port', process.env.PORT || 3000));
const host = option('--host', '0.0.0.0');
const files = {'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js','/research.js':'research.js','/icon.svg':'icon.svg'};
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res) => {
 const file = files[new URL(req.url,'http://localhost').pathname];
 if(!file){res.writeHead(404);res.end('Not found');return;}
 fs.readFile(path.join(__dirname,file),(error,body)=>{if(error){res.writeHead(500);res.end('Unable to read file');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);});
}).listen(port,host,()=>console.log(`DeepBrief preview: http://${host}:${port}`));
