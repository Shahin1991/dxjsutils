import HmacMD5 from 'crypto-js/hmac-md5';
import HmacSHA1 from 'crypto-js/hmac-sha1';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import HmacSHA384 from 'crypto-js/hmac-sha384';
import HmacSHA512 from 'crypto-js/hmac-sha512';
import Base64 from 'crypto-js/enc-base64';
import Hex from 'crypto-js/enc-hex';

export const ALGOS = [['HMAC-SHA256', HmacSHA256], ['HMAC-SHA512', HmacSHA512], ['HMAC-SHA384', HmacSHA384], ['HMAC-SHA1', HmacSHA1], ['HMAC-MD5', HmacMD5]];

export function hmac(fn, message, key, { keyHex = false, output = 'hex' } = {}) {
  if (keyHex && !/^([0-9a-f]{2})*$/i.test(key.replace(/\s+/g, ''))) throw new Error('The key is not valid hex');
  const k = keyHex ? Hex.parse(key.replace(/\s+/g, '')) : key;
  const h = fn(message, k);
  return output === 'base64' ? h.toString(Base64) : h.toString(Hex);
}
