/**
 * What the open builder is editing, so the "Open builder" dialog can warn before
 * something unsaved is lost (e.g. a private session, or changes that haven't saved yet).
 * Set by the builder's editor while it's mounted; null otherwise.
 */
let session = null;

export const setBuilderSession = (next) => {
  session = next;
};

export const getBuilderSession = () => session;
