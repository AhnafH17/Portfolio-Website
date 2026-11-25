/* The About section's story: where the camera stops, and what's written
   there. Words only from the site's existing About copy and the principles on
   the laptop's screen. They're real HTML (AboutSection), laid over the scene
   on the side the subject leaves free.

   node:  the model node to frame (null = the whole island)
   frame: how much room around it (higher = further back)
   dir:   where the camera looks from
   side:  where the words go on a wide screen ('left' | 'right'); the camera
          frames the subject in the rest of the screen. On a tall screen the
          words take the top band and the subject the part below them. */
export interface AboutStop {
  id: string;
  node: string | null;
  frame: number;
  dir: [number, number, number];
  side: 'left' | 'right';
  title: string;
  lines: string[];
  chips?: string[];
}

// A sweep from the desk down the left, across to the right and up to the
// core. The platforms' labels face +Z and their tops catch the light from the
// right, so every view comes from the front right.
export const ABOUT_STOPS: AboutStop[] = [
  { id: 'intro', node: 'BASE_Static', frame: 1.15, dir: [6, 5.2, 7], side: 'left',
    title: 'Lead by role, architect by craft.', lines: [] },
  { id: 'who', node: 'PLT_Desk', frame: 1.1, dir: [1.5, 3.4, 8], side: 'left',
    title: 'Ahnaf Hussain', lines: ['Head of Web Development at AurixLab', 'I design scalable systems and lead teams building modern web products.'] },
  { id: 'systems', node: 'PLT_Architecture', frame: 1.3, dir: [2, 5.2, 7], side: 'left',
    title: 'Systems Architecture', lines: ['Architecture-first: define the system before writing code.'] },
  { id: 'team', node: 'PLT_Deployment', frame: 1.3, dir: [2.6, 5.2, 6.6], side: 'left',
    title: 'Team Leadership', lines: ['Lead by doing, not delegating.'] },
  { id: 'frontend', node: 'PLT_Development', frame: 1.3, dir: [3.6, 4, 7], side: 'right',
    title: 'Frontend Standards', lines: ['Set frontend standards used on every project.'],
    chips: ['WordPress', 'Next.js', 'TypeScript', 'Shopify', 'Python', 'SEO'] },
  { id: 'core', node: 'CUBE_Core', frame: 3.2, dir: [6, 5.2, 7], side: 'left',
    title: 'Raise the floor, not just the ceiling.', lines: [] },
];

/** The longest word of a title, in characters: sets how big it can be set
    and still fit its column (the display face is very wide). */
export const longestWord = (title: string) => Math.max(...title.split(/\s+/).map((w) => w.length));
