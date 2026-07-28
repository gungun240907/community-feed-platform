async function getIpLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '::ffff:127.0.0.1') {
    return { city: 'Local', country: 'Local', raw: 'Local development' };
  }

  try {
    const https = require('https');
    const url = `https://ipapi.co/${ip}/json/`;

    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              resolve({ city: '', country: '', raw: '' });
            } else {
              resolve({
                city: json.city || '',
                country: json.country_name || '',
                raw: `${json.city || ''}, ${json.country_name || ''}`.replace(/^, /, '').replace(/, $/, ''),
              });
            }
          } catch {
            resolve({ city: '', country: '', raw: '' });
          }
        });
      });
      req.on('error', () => resolve({ city: '', country: '', raw: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ city: '', country: '', raw: '' }); });
    });
  } catch {
    return { city: '', country: '', raw: '' };
  }
}

module.exports = { getIpLocation };
