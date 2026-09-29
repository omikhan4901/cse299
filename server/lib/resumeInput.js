/** What clients may write into resume content (resumes and the Career Profile). */

// Photos are stored as data URLs: only allow real raster images of a sensible size.
const PHOTO = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
// The browser sends about 200 KB (lib photo.js); 1 MB still accepts every photo saved before that.
const MAX_PHOTO = 1024 * 1024;
const validPhoto = (v) => !v || (typeof v === 'string' && v.length <= MAX_PHOTO && PHOTO.test(v));

const CONTENT_KEYS = [
    'personal', 'summary', 'experience', 'education', 'projects', 'certifications', 'volunteering', 'awards', 'publications',
    'courses', 'references', 'referencesOnRequest', 'referenceSignatures', 'links', 'customSections', 'skills', 'languages', 'interests',
];

/** Copies the allowed keys, blanking photos that aren't real images. */
function pick(body = {}, keys) {
    const out = {};
    for (const key of keys) if (body[key] !== undefined) out[key] = body[key];
    if (out.personal && typeof out.personal === 'object') {
        for (const k of ['profilePic', 'profilePicSource']) if (!validPhoto(out.personal[k])) out.personal[k] = '';
    }
    return out;
}

// Text of one resume or profile, photos left out: a full two-page resume is about 10 KB, so
// this only stops runaway documents from filling the free database.
const MAX_TEXT = 300 * 1024;
/** An error message when the content (without photos) is too big to store, else null. */
function tooBig(data) {
    const personal = data.personal && typeof data.personal === 'object' ? { ...data.personal, profilePic: undefined, profilePicSource: undefined } : data.personal;
    return Buffer.byteLength(JSON.stringify({ ...data, personal })) > MAX_TEXT ? 'This is too long to save. Shorten or remove some sections and try again.' : null;
}

module.exports = { CONTENT_KEYS, pick, validPhoto, tooBig, MAX_TEXT };
