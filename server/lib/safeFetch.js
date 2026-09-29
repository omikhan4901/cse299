/**
 * Fetches a public web page's text for job capture, safely: only http(s) on the usual
 * ports, only public addresses (checked when connecting, so a DNS answer can't point it at
 * an internal service), at most 3 redirects, 8 seconds and 2 MB. LinkedIn is refused
 * (its terms forbid it); people paste the text instead.
 */
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const BLOCKED_HOSTS = /(^|\.)(linkedin\.com|lnkd\.in)$/i;

class FetchError extends Error {
    constructor(message, code = 'fetch_failed') {
        super(message);
        this.code = code;
    }
}

/** True for loopback, private, link-local, carrier-grade NAT, multicast and other non-public addresses. */
function isPrivateAddress(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return (
            a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && (b === 168 || (b === 0 && ip.split('.')[2] === '0'))) ||
            (a === 198 && (b === 18 || b === 19))
        );
    }
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateAddress(mapped[1]);
        return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith('64:ff9b:') || v.startsWith('2001:db8');
    }
    return true;
}

/** A DNS lookup that refuses non-public answers (used by the connection itself). */
function publicLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err);
        const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
        const bad = list.find((a) => isPrivateAddress(a.address));
        if (bad || !list.length) return callback(new FetchError("That address isn't a public website.", 'blocked'));
        if (options.all) return callback(null, list);
        callback(null, list[0].address, list[0].family);
    });
}

/** Checks a URL before fetching; returns a URL object or throws FetchError. */
function checkUrl(raw) {
    let url;
    try {
        url = new URL(String(raw || '').trim());
    } catch {
        throw new FetchError("That doesn't look like a link.", 'invalid');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new FetchError('Only web links (http or https) can be read.', 'invalid');
    if (url.username || url.password) throw new FetchError("Links with a username or password can't be read.", 'invalid');
    if (url.port && !['80', '443'].includes(url.port)) throw new FetchError("That address isn't a public website.", 'blocked');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (BLOCKED_HOSTS.test(host)) throw new FetchError("LinkedIn doesn't allow other sites to read its pages. Copy the job text and paste it instead.", 'linkedin');
    if (net.isIP(host) && isPrivateAddress(host)) throw new FetchError("That address isn't a public website.", 'blocked');
    if (/^localhost$|\.local(host)?$|\.internal$/i.test(host)) throw new FetchError("That address isn't a public website.", 'blocked');
    return url;
}

function get(url) {
    return new Promise((resolve, reject) => {
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.get(url, { lookup: publicLookup, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'ResumeX job capture (+https://resumex.cc)', Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1' } }, (res) => {
            const chunks = [];
            let size = 0;
            res.on('data', (c) => {
                size += c.length;
                if (size > MAX_BYTES) {
                    req.destroy();
                    reject(new FetchError('That page is too large to read. Copy the job text and paste it instead.', 'too_large'));
                } else chunks.push(c);
            });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new FetchError('That page took too long to load. Copy the job text and paste it instead.', 'timeout')));
        req.on('error', (err) => reject(err instanceof FetchError ? err : new FetchError("We couldn't open that page. Copy the job text and paste it instead.")));
    });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', bull: '•' };

/** Readable text from HTML: scripts and styles dropped, blocks on their own lines. */
function htmlToText(html) {
    return String(html || '')
        .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(br|\/p|\/div|\/h[1-6]|\/tr|\/section|\/article|\/header|\/ul|\/ol)\b[^>]*>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n- ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
            if (e[0] === '#') {
                const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
                return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
            }
            return ENTITIES[e.toLowerCase()] ?? m;
        })
        .replace(/[ \t\f\v\r]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** The page's title and text. Throws FetchError with a message people can act on. */
async function fetchPageText(raw) {
    let url = checkUrl(raw);
    for (let hop = 0; hop <= 3; hop++) {
        const res = await get(url);
        if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
            url = checkUrl(new URL(res.headers.location, url).toString());
            continue;
        }
        if (res.status >= 400) throw new FetchError(`That page answered with an error (${res.status}). Copy the job text and paste it instead.`);
        const type = String(res.headers['content-type'] || '');
        if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new FetchError("That link isn't a web page we can read. Copy the job text and paste it instead.", 'unsupported');
        const title = htmlToText(res.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 200);
        const body = res.body.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? res.body;
        const text = (/text\/plain/i.test(type) ? res.body : htmlToText(body)).slice(0, 30000);
        if (text.replace(/\s/g, '').length < 80) throw new FetchError("That page has almost no text (it may need JavaScript to show the job). Copy the job text and paste it instead.", 'empty');
        return { url: url.toString(), title, text };
    }
    throw new FetchError('That link redirects too many times. Copy the job text and paste it instead.');
}

module.exports = { fetchPageText, htmlToText, isPrivateAddress, checkUrl, FetchError };
