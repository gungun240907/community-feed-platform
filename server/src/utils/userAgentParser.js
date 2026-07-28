function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', deviceType: 'unknown' };

  const lower = ua.toLowerCase();

  let browser = 'Unknown';
  if (lower.includes('firefox') && !lower.includes('seamonkey')) browser = 'Firefox';
  else if (lower.includes('edg/') || lower.includes('edge/')) browser = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('chrome') && !lower.includes('edg') && !lower.includes('opr')) browser = 'Chrome';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('msie') || lower.includes('trident')) browser = 'Internet Explorer';

  let os = 'Unknown';
  if (lower.includes('windows nt 10')) os = 'Windows 10';
  else if (lower.includes('windows nt 11')) os = 'Windows 11';
  else if (lower.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (lower.includes('windows nt 6.2')) os = 'Windows 8';
  else if (lower.includes('windows nt 6.1')) os = 'Windows 7';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os x') || lower.includes('macintosh')) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
  } else if (lower.includes('linux') && !lower.includes('android')) os = 'Linux';
  else if (lower.includes('android')) {
    const match = ua.match(/Android (\d+(?:\.\d+)+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ipod')) {
    const match = ua.match(/OS (\d+[._]\d+)/);
    os = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
  } else if (lower.includes('cros')) os = 'Chrome OS';

  let deviceType = 'desktop';
  if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('phone')) deviceType = 'mobile';
  else if (lower.includes('ipad') || lower.includes('tablet') || lower.includes('tab')) deviceType = 'tablet';

  return { browser, os, deviceType };
}

function generateDeviceFingerprint(ua, ip, acceptLanguage) {
  const raw = [ua || '', ip || '', acceptLanguage || ''].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

module.exports = { parseUserAgent, generateDeviceFingerprint };
