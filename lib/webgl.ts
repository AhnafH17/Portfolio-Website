let available: boolean | undefined;

/** Constructors can exist even when policy or a graphics driver blocks WebGL. */
export function hasWebGL() {
  if (typeof document === 'undefined') return false;
  if (available === undefined) {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      available = Boolean(context);
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      available = false;
    }
  }
  return available;
}
