import { renderResumeToBuffer } from "./render";

// Rendering takes a few hundred milliseconds, so it runs off the main thread
// to keep typing in the editor smooth.
self.onmessage = async (event) => {
  const { id, resume, fontBase } = event.data;
  try {
    const buffer = await renderResumeToBuffer(resume, fontBase);
    self.postMessage({ id, buffer }, [buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
