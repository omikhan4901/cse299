/** What clients may write into resume content (resumes and the Career Profile). */

// Photos are stored as data URLs: only allow real raster images of a sensible size.
const PHOTO = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO = 3 * 1024 * 1024;
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

module.exports = { CONTENT_KEYS, pick, validPhoto };
