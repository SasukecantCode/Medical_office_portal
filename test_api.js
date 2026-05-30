const http = require('http');
const req = http.request('http://127.0.0.1:8000/api/hr/agent/fields', { method: 'GET' }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', data.substring(0, 100)));
});
req.on('error', e => console.error(e));
req.end();
